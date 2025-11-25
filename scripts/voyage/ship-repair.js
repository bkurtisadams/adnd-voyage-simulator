/**
 * Ship Repair System
 * Handles hull damage repairs per "Oops, I'm at Sea" rules
 */

export class ShipRepairSystem {

    /**
     * Check if repairs are available at this port
     */
    static canRepairAtPort(portSize) {
        // Can repair at any port (Minor Port or larger)
        return ["Minor Port", "Port", "Major Port"].includes(portSize);
    }

    /**
     * Calculate professional repair costs
     * Rules: 100 gp per day per hull point
     */
    static calculateProfessionalRepairCost(hullDamage) {
        const costPerDay = 100;
        const days = hullDamage;
        return {
            cost: costPerDay * hullDamage,
            days: days,
            costPerPoint: costPerDay
        };
    }

    /**
     * Calculate DIY repair costs (with proficiency)
     * Rules: 50 gp materials per hull point, 1 week per point
     */
    static calculateDIYRepairCost(hullDamage) {
        const costPerPoint = 50;
        const weeksPerPoint = 1;
        return {
            cost: costPerPoint * hullDamage,
            weeks: weeksPerPoint * hullDamage,
            days: weeksPerPoint * 7 * hullDamage,
            costPerPoint: costPerPoint,
            requiresProficiency: true,
            cargoLoadsNeeded: hullDamage // 1 load per hull point for materials
        };
    }

    /**
     * Present repair options dialog (for manual mode)
     */
    static async offerRepairChoice(currentHull, maxHull, treasury, hasProficiency) {
        const damage = maxHull - currentHull;
        if (damage === 0) return null;

        const professional = this.calculateProfessionalRepairCost(damage);
        const diy = this.calculateDIYRepairCost(damage);

        const canAffordPro = treasury >= professional.cost;
        const canAffordDIY = treasury >= diy.cost;

        let content = `
            <div class="repair-options">
                <h3>Ship Repairs Available</h3>
                <p><strong>Current Hull:</strong> ${currentHull}/${maxHull} (${damage} damage)</p>
                
                <h4>Professional Repairs</h4>
                <p>Cost: ${professional.cost} gp (${professional.costPerPoint} gp per hull point)</p>
                <p>Time: ${professional.days} days</p>
                ${!canAffordPro ? '<p style="color:red;">Cannot afford</p>' : ''}
                
                <h4>DIY Repairs ${!hasProficiency ? '(Requires Shipwright/Ship Carpentry)' : ''}</h4>
                <p>Cost: ${diy.cost} gp materials (${diy.costPerPoint} gp per hull point)</p>
                <p>Time: ${diy.weeks} weeks (${diy.days} days)</p>
                <p>Cargo space: ${diy.cargoLoadsNeeded} loads for materials</p>
                ${!canAffordDIY ? '<p style="color:red;">Cannot afford</p>' : ''}
                ${!hasProficiency ? '<p style="color:red;">No qualified crew</p>' : ''}
                
                <p><strong>Skip repairs?</strong> You can continue sailing with damage.</p>
            </div>
        `;

        return new Promise((resolve) => {
            new Dialog({
                title: "Ship Repairs",
                content: content,
                buttons: {
                    professional: {
                        label: "Professional Repair",
                        disabled: !canAffordPro,
                        callback: () => resolve({ type: "professional", ...professional })
                    },
                    diy: {
                        label: "DIY Repair",
                        disabled: !canAffordDIY || !hasProficiency,
                        callback: () => resolve({ type: "diy", ...diy })
                    },
                    skip: {
                        label: "Skip Repairs",
                        callback: () => resolve(null)
                    }
                },
                default: "skip"
            }).render(true);
        });
    }

    /**
     * Auto-decision for repairs (automation mode)
     * Rules: Repair if damage >= 25% of max hull AND can afford professional
     */
    static shouldAutoRepair(currentHull, maxHull, treasury) {
        const damage = maxHull - currentHull;
        const damagePercent = (damage / maxHull) * 100;
        
        if (damagePercent < 10) return null; // Minor damage, skip
        
        const professional = this.calculateProfessionalRepairCost(damage);
        
        if (treasury >= professional.cost) {
            return { type: "professional", ...professional };
        }
        
        return null; // Can't afford, skip
    }
}