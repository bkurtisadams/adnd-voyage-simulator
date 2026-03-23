/**
 * Boarding Combat System
 * Resolves mass combat when hostiles board the ship.
 *
 * Two layers:
 *   1. Mass combat — marines/crew vs boarder force, resolved in abstract rounds.
 *   2. PC encounter — a leader + retinue split off for Foundry tactical combat.
 *      GM resolves that fight, then clicks a button on the chat card to feed
 *      the result back into the mass combat.
 *
 * Boarder types that trigger this system:
 *   pirate, buccaneer — ship grapple phase first, then boarding
 *   sahuagin, merrow, scrag, sea hag — climb hull, skip grapple
 *   other "boarding" type from canCreatureHarmShip
 */

export class BoardingCombat {

    // =========================================================================
    // STATIC CONSTANTS
    // =========================================================================

    static CREW_QUALITY_STRENGTH = {
        "Landlubber": 0.4,
        "Green": 0.6,
        "Average": 0.8,
        "Trained": 1.0,
        "Crack": 1.3,
        "Old Salts": 1.5
    };

    static MORALE_TARGETS = {
        "Landlubber": 5,
        "Green": 6,
        "Average": 7,
        "Trained": 8,
        "Crack": 9,
        "Old Salts": 10
    };

    // =========================================================================
    // BOARDING DETECTION
    // =========================================================================

    /**
     * Determine if an encounter triggers the boarding system.
     * Returns null if no boarding, or a boarding context object.
     */
    static detectBoarding(encounter, classification, numberAppearing, canHarmResult) {
        if (classification !== "threat") return null;
        const type = canHarmResult?.type;
        if (!type) return null;

        const boardingTypes = ["pirate", "boarding"];
        if (!boardingTypes.includes(type)) return null;

        const name = encounter.name.toLowerCase();
        const requiresGrapple = ["pirate", "buccaneer", "raider", "warship", "galley"]
            .some(p => name.includes(p));

        const hdMatch = encounter.hd?.match(/(\d+)/);
        const baseHD = hdMatch ? parseInt(hdMatch[1]) : 2;

        // Determine leader presence — intelligent boarders always have one
        const hasLeader = true;
        const leaderHD = Math.max(baseHD + 2, Math.floor(baseHD * 1.5));
        // Retinue: 1-3 tougher boarders that accompany the leader
        const retinueCount = Math.min(3, Math.max(1, Math.floor(numberAppearing / 8)));
        const retinueHD = baseHD + 1;

        // Main force = total minus leader minus retinue
        const mainForceCount = Math.max(1, numberAppearing - 1 - retinueCount);

        return {
            isBoardingAction: true,
            requiresGrapple,
            encounter,
            boarderName: encounter.name,
            totalBoarders: numberAppearing,
            mainForce: { count: mainForceCount, hd: baseHD },
            leader: hasLeader ? { hd: leaderHD, name: `${encounter.name} Leader` } : null,
            retinue: { count: retinueCount, hd: retinueHD },
            boarderType: type
        };
    }

    // =========================================================================
    // GRAPPLE PHASE (pirates only)
    // =========================================================================

    /**
     * Resolve ship-to-ship grapple attempt.
     * DMG: 25% chance the grappled ship can sever the line or remove the grapnel.
     * @returns {{ grappled: boolean, cutFreeRoll: number, note: string }}
     */
    static async resolveGrapple(state) {
        const cutFreeRoll = new Roll("1d100");
        await cutFreeRoll.evaluate();

        const cutFree = cutFreeRoll.total <= 25;

        if (cutFree) {
            return {
                grappled: false,
                cutFreeRoll: cutFreeRoll.total,
                note: `Crew cuts grappling lines! (${cutFreeRoll.total} ≤ 25%) Boarding averted — boarders may pursue.`
            };
        }
        return {
            grappled: true,
            cutFreeRoll: cutFreeRoll.total,
            note: `Grappled! (${cutFreeRoll.total} > 25%) Boarders swarm aboard!`
        };
    }

    /**
     * Calculate boarding height advantage modifier per DMG.
     * Galley crew boarding a merchant/warship: attackers -1, defenders +1.
     * Same ship class: no modifier.
     * @returns {{ attackerMod: number, defenderMod: number, note: string }}
     */
    static getHeightAdvantage(attackerClass, defenderClass) {
        const highShips = ["merchant", "warship"];
        const lowShips = ["galley", "rowboat", "barge"];
        if (lowShips.includes(attackerClass) && highShips.includes(defenderClass)) {
            return { attackerMod: -1, defenderMod: 1, note: "Height advantage: defenders +1, boarders -1" };
        }
        if (highShips.includes(attackerClass) && lowShips.includes(defenderClass)) {
            return { attackerMod: 1, defenderMod: -1, note: "Height advantage: boarders +1, defenders -1" };
        }
        return { attackerMod: 0, defenderMod: 0, note: "" };
    }

    // =========================================================================
    // MASS COMBAT RESOLUTION
    // =========================================================================

    /**
     * Calculate effective combat strength for one side.
     * Marines fight at full value; sailors fight at half.
     */
    static calculateDefenderStrength(state) {
        const marines = state.currentCrew?.find(c => c.role === "marine" || c.role === "marines");
        const sailors = state.currentCrew?.find(c => c.role === "sailor" || c.role === "sailors");
        const marineCount = marines?.count || 0;
        const sailorCount = sailors?.count || 0;
        const qualityMod = this.CREW_QUALITY_STRENGTH[state.crewQuality] || 1.0;

        // Marines fight at 1 HD equivalent, sailors at 0.5
        const effectiveStrength = (marineCount * 1.0 + sailorCount * 0.5) * qualityMod;
        const moraleTarget = this.MORALE_TARGETS[state.crewQuality] || 7;

        return {
            marineCount,
            sailorCount,
            totalFighters: marineCount + sailorCount,
            effectiveStrength,
            moraleTarget,
            qualityMod
        };
    }

    static calculateAttackerStrength(boardingCtx) {
        const mf = boardingCtx.mainForce;
        // Each boarder = their HD as strength
        const effectiveStrength = mf.count * mf.hd;
        // Boarder morale: pirates 8, monsters 7, sahuagin 9
        const name = boardingCtx.boarderName.toLowerCase();
        let moraleTarget = 7;
        if (name.includes("pirate") || name.includes("buccaneer")) moraleTarget = 8;
        if (name.includes("sahuagin")) moraleTarget = 9;

        return {
            count: mf.count,
            hd: mf.hd,
            effectiveStrength,
            moraleTarget
        };
    }

    /**
     * Resolve one round of mass combat.
     * Opposed d20 + strength modifier. Loser takes casualties.
     * Returns round result object.
     */
    static async resolveMassCombatRound(defenderState, attackerState, roundNum, pcModifier = 0, attackerModifier = 0) {
        const defRoll = new Roll("1d20");
        const atkRoll = new Roll("1d20");
        await defRoll.evaluate();
        await atkRoll.evaluate();

        const defTotal = defRoll.total + Math.floor(defenderState.effectiveStrength / 5) + pcModifier;
        const atkTotal = atkRoll.total + Math.floor(attackerState.effectiveStrength / 5) + attackerModifier;

        let defCasualties = 0;
        let atkCasualties = 0;

        if (defTotal > atkTotal) {
            // Attackers take casualties
            const margin = defTotal - atkTotal;
            atkCasualties = Math.max(1, Math.floor(margin / 3));
            atkCasualties = Math.min(atkCasualties, attackerState.count);
        } else if (atkTotal > defTotal) {
            // Defenders take casualties
            const margin = atkTotal - defTotal;
            defCasualties = Math.max(1, Math.floor(margin / 3));
            defCasualties = Math.min(defCasualties, defenderState.totalFighters);
        } else {
            // Tie — both sides take 1 casualty
            defCasualties = 1;
            atkCasualties = 1;
        }

        return {
            round: roundNum,
            defRoll: defRoll.total,
            atkRoll: atkRoll.total,
            defTotal,
            atkTotal,
            defCasualties,
            atkCasualties,
            defStrength: defenderState.effectiveStrength,
            atkStrength: attackerState.effectiveStrength
        };
    }

    /**
     * Check morale after casualties.
     * Morale breaks at 25% losses (check), 50% losses (check at -2).
     * Returns { broken: boolean, roll: number, target: number }
     */
    static async checkMorale(originalCount, currentCount, moraleTarget, leaderKilled = false) {
        const lossPercent = ((originalCount - currentCount) / originalCount) * 100;
        if (lossPercent < 25) return { broken: false, checked: false };

        let modifier = 0;
        if (lossPercent >= 50) modifier = -2;
        if (lossPercent >= 75) modifier = -4;
        if (leaderKilled) modifier -= 4;

        const effectiveTarget = Math.max(2, moraleTarget + modifier);
        const moraleRoll = new Roll("2d6");
        await moraleRoll.evaluate();

        return {
            broken: moraleRoll.total > effectiveTarget,
            checked: true,
            roll: moraleRoll.total,
            target: effectiveTarget,
            lossPercent: Math.round(lossPercent)
        };
    }

    // =========================================================================
    // FULL AUTO-RESOLVE (for automated voyages)
    // =========================================================================

    /**
     * Run the entire boarding action to completion without GM interaction.
     * Returns a result summary suitable for the voyage log.
     */
    static async autoResolve(state, boardingCtx) {
        const results = {
            rounds: [],
            defenderVictory: false,
            attackerVictory: false,
            defenderBroke: false,
            attackerBroke: false,
            totalDefCasualties: 0,
            totalAtkCasualties: 0,
            hullDamage: 0,
            leaderEscaped: false,
            grapple: null,
            notes: []
        };

        // Grapple phase
        if (boardingCtx.requiresGrapple) {
            const grapple = await this.resolveGrapple(state);
            results.grapple = grapple;
            if (!grapple.grappled) {
                results.notes.push(grapple.note);
                // Ship escapes — but takes a parting shot
                const partingRoll = new Roll("1d4");
                await partingRoll.evaluate();
                results.hullDamage = partingRoll.total;
                results.notes.push(`Parting shot: ${partingRoll.total} hull damage as ship pulls away.`);
                return results;
            }
            results.notes.push(grapple.note);
        }

        // Setup combat state
        const defender = this.calculateDefenderStrength(state);
        const attacker = this.calculateAttackerStrength(boardingCtx);

        // Height advantage per DMG: galley boarding merchant/warship = -1/+1
        const defenderClass = state.ship?.shipClass || "merchant";
        const heightAdv = this.getHeightAdvantage("galley", defenderClass); // boarders approach from lower vessel
        if (heightAdv.note) results.notes.push(heightAdv.note);

        const origDefCount = defender.totalFighters;
        const origAtkCount = attacker.count;
        let currentDefMarines = defender.marineCount;
        let currentDefSailors = defender.sailorCount;
        let currentAtkCount = attacker.count;
        let leaderKilled = false;

        // Auto-resolve leader encounter: 50% chance PCs "win" (simplified)
        if (boardingCtx.leader) {
            const leaderRoll = Math.random();
            if (leaderRoll < 0.5) {
                leaderKilled = true;
                results.notes.push(`The ${boardingCtx.leader.name} is slain during the fighting!`);
            } else {
                results.notes.push(`The ${boardingCtx.leader.name} fights fiercely through the battle.`);
            }
        }

        // Combat rounds (max 10 to prevent infinite loops)
        for (let round = 1; round <= 10; round++) {
            const defState = {
                ...defender,
                marineCount: currentDefMarines,
                sailorCount: currentDefSailors,
                totalFighters: currentDefMarines + currentDefSailors,
                effectiveStrength: (currentDefMarines * 1.0 + currentDefSailors * 0.5) * defender.qualityMod
            };
            const atkState = {
                ...attacker,
                count: currentAtkCount,
                effectiveStrength: currentAtkCount * attacker.hd
            };

            if (defState.totalFighters <= 0 || atkState.count <= 0) break;

            const pcMod = leaderKilled ? 2 : 0;
            const roundResult = await this.resolveMassCombatRound(defState, atkState, round, pcMod + heightAdv.defenderMod, heightAdv.attackerMod);
            results.rounds.push(roundResult);

            // Apply casualties to defenders: marines first
            let defLoss = roundResult.defCasualties;
            const marineLoss = Math.min(defLoss, currentDefMarines);
            currentDefMarines -= marineLoss;
            defLoss -= marineLoss;
            currentDefSailors = Math.max(0, currentDefSailors - defLoss);
            results.totalDefCasualties += roundResult.defCasualties;

            // Apply casualties to attackers
            currentAtkCount = Math.max(0, currentAtkCount - roundResult.atkCasualties);
            results.totalAtkCasualties += roundResult.atkCasualties;

            // Check attacker morale
            const atkMorale = await this.checkMorale(
                origAtkCount, currentAtkCount, attacker.moraleTarget, leaderKilled
            );
            if (atkMorale.broken) {
                results.attackerBroke = true;
                results.defenderVictory = true;
                results.notes.push(`Round ${round}: Boarders break and flee! (Morale ${atkMorale.roll} > ${atkMorale.target}, ${atkMorale.lossPercent}% losses)`);
                break;
            }

            // Check defender morale
            const defMorale = await this.checkMorale(
                origDefCount, currentDefMarines + currentDefSailors, defender.moraleTarget
            );
            if (defMorale.broken) {
                results.defenderBroke = true;
                results.attackerVictory = true;
                results.notes.push(`Round ${round}: Crew breaks! (Morale ${defMorale.roll} > ${defMorale.target}, ${defMorale.lossPercent}% losses)`);
                break;
            }

            // Check for wipeout
            if (currentAtkCount <= 0) {
                results.defenderVictory = true;
                results.notes.push(`Round ${round}: All boarders slain!`);
                break;
            }
            if (currentDefMarines + currentDefSailors <= 0) {
                results.attackerVictory = true;
                results.notes.push(`Round ${round}: All defenders slain!`);
                break;
            }
        }

        // If no clear winner after 10 rounds, mutual withdrawal
        if (!results.defenderVictory && !results.attackerVictory) {
            results.notes.push("Fighting devolves into a stalemate. Boarders withdraw.");
            results.defenderVictory = true;
        }

        // Hull damage from boarding action: d4 per 2 rounds fought
        const hullDmgDice = Math.max(1, Math.floor(results.rounds.length / 2));
        const hullRoll = new Roll(`${hullDmgDice}d4`);
        await hullRoll.evaluate();
        results.hullDamage += hullRoll.total;

        // If attackers won: plunder
        if (results.attackerVictory) {
            results.notes.push("Boarders seize the ship! Cargo and treasury are plundered.");
        }

        return results;
    }

    // =========================================================================
    // INTERACTIVE CHAT CARD (for manual mode / GM-driven voyages)
    // =========================================================================

    /**
     * Post the boarding action chat card and begin mass combat.
     * The card shows round-by-round updates and buttons for the GM
     * to report the PC encounter result.
     *
     * Returns the ChatMessage id. The GM responds via button clicks
     * which are handled by the renderChatMessage hook in main.js.
     */
    static async postBoardingCard(state, boardingCtx, encounterResult) {
        const defender = this.calculateDefenderStrength(state);
        const attacker = this.calculateAttackerStrength(boardingCtx);

        const leader = boardingCtx.leader;
        const retinue = boardingCtx.retinue;

        // Build the initial card
        const cardHtml = `
        <div class="boarding-combat-card" data-voyage-id="${state.id || ''}" data-boarding-id="${Date.now()}">
            <div class="boarding-header">
                <h3>⚔️ BOARDING ACTION</h3>
                <p>${boardingCtx.boarderName} (×${boardingCtx.totalBoarders}) swarm aboard!</p>
            </div>

            <div class="boarding-forces">
                <div class="boarding-side boarding-defenders">
                    <h4>🛡️ Ship's Defenders</h4>
                    <p>Marines: <strong>${defender.marineCount}</strong> | Sailors: <strong>${defender.sailorCount}</strong></p>
                    <p>Quality: ${state.crewQuality || 'Average'} | Strength: ${Math.round(defender.effectiveStrength)}</p>
                </div>
                <div class="boarding-side boarding-attackers">
                    <h4>☠️ Boarders</h4>
                    <p>Main Force: <strong>${boardingCtx.mainForce.count}</strong> (${boardingCtx.mainForce.hd} HD each)</p>
                    <p>Strength: ${Math.round(attacker.effectiveStrength)}</p>
                </div>
            </div>

            ${leader ? `
            <div class="boarding-pc-encounter">
                <h4>🎯 PC Encounter</h4>
                <p><strong>${leader.name}</strong> (${leader.hd} HD) + ${retinue.count} ${boardingCtx.boarderName} guards (${retinue.hd} HD each) break away toward the party!</p>
                <p class="boarding-pc-status">Status: <strong>AWAITING GM</strong></p>
                <p><em>Run this fight in Foundry, then report the result:</em></p>
                <div class="boarding-pc-buttons">
                    <button class="boarding-btn boarding-btn-leader-killed" data-action="leaderKilled">☠️ Leader Killed</button>
                    <button class="boarding-btn boarding-btn-pcs-won" data-action="pcsWon">⚔️ PCs Won</button>
                    <button class="boarding-btn boarding-btn-pcs-fell-back" data-action="pcsFellBack">🏃 PCs Fell Back</button>
                    <button class="boarding-btn boarding-btn-skip" data-action="skipPcFight">⏩ Auto-Resolve</button>
                </div>
            </div>
            ` : ''}

            <div class="boarding-rounds">
                <h4>Mass Combat Rounds</h4>
                <p class="boarding-rounds-status"><em>Waiting for PC encounter result before resolving…</em></p>
                <div class="boarding-rounds-log"></div>
            </div>

            <div class="boarding-result" style="display:none;">
                <h4>⚓ Boarding Outcome</h4>
                <div class="boarding-result-text"></div>
            </div>
        </div>`;

        const msg = await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ alias: "Voyage Simulator" }),
            content: cardHtml,
            flags: {
                'adnd-voyage-simulator': {
                    boardingAction: true,
                    voyageId: state.id || null,
                    boardingCtx: boardingCtx,
                    defenderState: {
                        marineCount: defender.marineCount,
                        sailorCount: defender.sailorCount,
                        effectiveStrength: defender.effectiveStrength,
                        moraleTarget: defender.moraleTarget,
                        qualityMod: defender.qualityMod,
                        crewQuality: state.crewQuality
                    },
                    attackerState: {
                        count: attacker.count,
                        hd: attacker.hd,
                        effectiveStrength: attacker.effectiveStrength,
                        moraleTarget: attacker.moraleTarget
                    },
                    pcResult: null,
                    resolved: false
                }
            }
        });

        return msg.id;
    }

    /**
     * Called when GM clicks a PC result button on the chat card.
     * Resolves mass combat with the PC modifier, updates the card,
     * and applies results to voyage state.
     *
     * @param {string} messageId - The ChatMessage ID
     * @param {string} pcAction - "leaderKilled" | "pcsWon" | "pcsFellBack" | "skipPcFight"
     */
    static async resolveBoardingFromCard(messageId, pcAction) {
        const msg = game.messages.get(messageId);
        if (!msg) return;

        const flags = msg.flags?.['adnd-voyage-simulator'];
        if (!flags || flags.resolved) return;

        const boardingCtx = flags.boardingCtx;
        const defState = flags.defenderState;
        const atkState = flags.attackerState;
        const voyageId = flags.voyageId;

        // Determine PC modifier for mass combat
        let pcModifier = 0;
        let leaderKilled = false;
        let pcNote = "";

        switch (pcAction) {
            case "leaderKilled":
                pcModifier = 4;
                leaderKilled = true;
                pcNote = `The ${boardingCtx.leader?.name || 'leader'} is slain by the party! Boarders waver.`;
                break;
            case "pcsWon":
                pcModifier = 2;
                pcNote = "The party drives back the leader's retinue! Marines rally.";
                break;
            case "pcsFellBack":
                pcModifier = -2;
                pcNote = "The party falls back under pressure. Boarders press the advantage.";
                break;
            case "skipPcFight":
                pcModifier = Math.random() < 0.5 ? 2 : 0;
                leaderKilled = pcModifier > 0;
                pcNote = leaderKilled
                    ? `The ${boardingCtx.leader?.name || 'leader'} falls in the confused fighting.`
                    : `The ${boardingCtx.leader?.name || 'leader'} fights on through the melee.`;
                break;
        }

        // Resolve mass combat rounds
        const origDefCount = defState.marineCount + defState.sailorCount;
        const origAtkCount = atkState.count;
        let curMarines = defState.marineCount;
        let curSailors = defState.sailorCount;
        let curAtk = atkState.count;

        const rounds = [];
        let defenderVictory = false;
        let attackerVictory = false;
        const notes = [pcNote];

        for (let round = 1; round <= 10; round++) {
            const dS = {
                totalFighters: curMarines + curSailors,
                effectiveStrength: (curMarines * 1.0 + curSailors * 0.5) * defState.qualityMod,
                moraleTarget: defState.moraleTarget,
                marineCount: curMarines,
                sailorCount: curSailors
            };
            const aS = {
                count: curAtk,
                hd: atkState.hd,
                effectiveStrength: curAtk * atkState.hd,
                moraleTarget: atkState.moraleTarget
            };

            if (dS.totalFighters <= 0 || aS.count <= 0) break;

            const rr = await this.resolveMassCombatRound(dS, aS, round, pcModifier);
            rounds.push(rr);

            // Apply defender casualties (marines first)
            let dLoss = rr.defCasualties;
            const mLoss = Math.min(dLoss, curMarines);
            curMarines -= mLoss;
            dLoss -= mLoss;
            curSailors = Math.max(0, curSailors - dLoss);

            curAtk = Math.max(0, curAtk - rr.atkCasualties);

            // Morale checks
            const atkMorale = await this.checkMorale(origAtkCount, curAtk, atkState.moraleTarget, leaderKilled);
            if (atkMorale.broken) {
                defenderVictory = true;
                notes.push(`Round ${round}: Boarders break! (Morale ${atkMorale.roll} > ${atkMorale.target})`);
                break;
            }
            const defMorale = await this.checkMorale(origDefCount, curMarines + curSailors, defState.moraleTarget);
            if (defMorale.broken) {
                attackerVictory = true;
                notes.push(`Round ${round}: Crew breaks! (Morale ${defMorale.roll} > ${defMorale.target})`);
                break;
            }
            if (curAtk <= 0) { defenderVictory = true; notes.push(`Round ${round}: All boarders slain!`); break; }
            if (curMarines + curSailors <= 0) { attackerVictory = true; notes.push(`Round ${round}: All defenders fallen!`); break; }
        }

        if (!defenderVictory && !attackerVictory) {
            defenderVictory = true;
            notes.push("Stalemate — boarders withdraw.");
        }

        // Hull damage
        const hullDice = Math.max(1, Math.floor(rounds.length / 2));
        const hullRoll = new Roll(`${hullDice}d4`);
        await hullRoll.evaluate();
        const hullDamage = hullRoll.total;

        const totalDefCasualties = origDefCount - (curMarines + curSailors);
        const totalAtkCasualties = origAtkCount - curAtk;

        // Build round log HTML
        let roundsHtml = "";
        for (const r of rounds) {
            const winner = r.defTotal > r.atkTotal ? "defenders" : r.atkTotal > r.defTotal ? "attackers" : "tie";
            roundsHtml += `<p class="boarding-round"><strong>Round ${r.round}:</strong> `;
            roundsHtml += `Def ${r.defRoll}+${Math.floor(r.defStrength/5)}${pcModifier ? `+${pcModifier}pc` : ''}=${r.defTotal} `;
            roundsHtml += `vs Atk ${r.atkRoll}+${Math.floor(r.atkStrength/5)}=${r.atkTotal} → `;
            if (winner === "defenders") roundsHtml += `<span class="boarding-win">Boarders lose ${r.atkCasualties}</span>`;
            else if (winner === "attackers") roundsHtml += `<span class="boarding-loss">Crew lose ${r.defCasualties}</span>`;
            else roundsHtml += `<span class="boarding-tie">Both sides lose 1</span>`;
            roundsHtml += `</p>`;
        }

        // Build result HTML
        let resultHtml = `<p><strong>${defenderVictory ? '🛡️ VICTORY!' : '☠️ DEFEATED!'}</strong></p>`;
        resultHtml += `<p>Crew casualties: ${totalDefCasualties} (Marines: ${defState.marineCount - curMarines}, Sailors: ${defState.sailorCount - curSailors})</p>`;
        resultHtml += `<p>Boarder casualties: ${totalAtkCasualties} of ${origAtkCount}</p>`;
        resultHtml += `<p>Hull damage from fighting: ${hullDamage} HP</p>`;
        for (const n of notes) resultHtml += `<p><em>${n}</em></p>`;

        if (attackerVictory) {
            resultHtml += `<p><strong>The boarders have taken the ship!</strong> Cargo and treasury are at risk.</p>`;
        }

        // Update the chat card
        const el = document.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            const roundsLog = el.querySelector('.boarding-rounds-log');
            const roundsStatus = el.querySelector('.boarding-rounds-status');
            const resultDiv = el.querySelector('.boarding-result');
            const resultText = el.querySelector('.boarding-result-text');
            const pcButtons = el.querySelector('.boarding-pc-buttons');
            const pcStatus = el.querySelector('.boarding-pc-status');

            if (roundsLog) roundsLog.innerHTML = roundsHtml;
            if (roundsStatus) roundsStatus.style.display = 'none';
            if (resultDiv) resultDiv.style.display = 'block';
            if (resultText) resultText.innerHTML = resultHtml;
            if (pcButtons) pcButtons.innerHTML = `<em>Resolved: ${pcAction}</em>`;
            if (pcStatus) pcStatus.innerHTML = `Status: <strong>${pcAction.toUpperCase()}</strong>`;
        }

        // Persist the card content update
        const updatedContent = el?.querySelector('.boarding-combat-card')?.outerHTML || msg.content;
        await msg.update({
            content: updatedContent,
            'flags.adnd-voyage-simulator.resolved': true,
            'flags.adnd-voyage-simulator.pcResult': pcAction,
            'flags.adnd-voyage-simulator.combatResult': {
                defenderVictory,
                attackerVictory,
                totalDefCasualties,
                totalAtkCasualties,
                hullDamage,
                rounds: rounds.length,
                leaderKilled,
                marineLoss: defState.marineCount - curMarines,
                sailorLoss: defState.sailorCount - curSailors
            }
        });

        // Apply results to voyage state if we have a voyageId
        if (voyageId) {
            await this.applyBoardingResults(voyageId, {
                defenderVictory,
                attackerVictory,
                marineLoss: defState.marineCount - curMarines,
                sailorLoss: defState.sailorCount - curSailors,
                hullDamage,
                plundered: attackerVictory
            });
        }

        return {
            defenderVictory, attackerVictory,
            totalDefCasualties, totalAtkCasualties,
            hullDamage, leaderKilled, rounds: rounds.length
        };
    }

    /**
     * Apply boarding combat results to the persisted voyage state.
     */
    static async applyBoardingResults(voyageId, results) {
        const { VoyageSimulator } = await import('./simulation.js');
        const state = await VoyageSimulator.loadState(voyageId);
        if (!state) return;

        // Apply hull damage
        state.ship.hullPoints.value = Math.max(0, state.ship.hullPoints.value - results.hullDamage);
        state.totalHullDamage += results.hullDamage;

        // Apply crew losses
        if (results.marineLoss > 0) {
            const marines = state.currentCrew.find(c => c.role === "marine" || c.role === "marines");
            if (marines) marines.count = Math.max(0, marines.count - results.marineLoss);
        }
        if (results.sailorLoss > 0) {
            const sailors = state.currentCrew.find(c => c.role === "sailor" || c.role === "sailors");
            if (sailors) sailors.count = Math.max(0, sailors.count - results.sailorLoss);
        }

        // If plundered, lose cargo and a chunk of treasury
        if (results.plundered) {
            state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
            const plunderAmount = Math.floor(state.treasury * 0.75);
            state.treasury -= plunderAmount;
            state.voyageLogHtml.value += `<p><strong>☠️ Plundered!</strong> Lost all cargo and ${plunderAmount} gp.</p>`;
        }

        state.events.push({
            type: 'boarding',
            date: state.shipEndDate || 'At Sea',
            defenderVictory: results.defenderVictory,
            marineLoss: results.marineLoss,
            sailorLoss: results.sailorLoss,
            hullDamage: results.hullDamage,
            plundered: results.plundered
        });

        await VoyageSimulator.saveState(voyageId, state);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Generate a short summary string for the voyage log.
     */
    static formatAutoResultForLog(results, boardingCtx) {
        const outcome = results.defenderVictory ? "Repelled" : "Defeated by";
        let text = `⚔️ Boarding action: ${boardingCtx.boarderName} (×${boardingCtx.totalBoarders}). `;
        text += `${outcome} after ${results.rounds.length} rounds. `;
        text += `Crew casualties: ${results.totalDefCasualties}. Boarder casualties: ${results.totalAtkCasualties}. `;
        text += `Hull damage: ${results.hullDamage}.`;
        if (results.notes.length) text += ` ${results.notes.join(" ")}`;
        return text;
    }
}
