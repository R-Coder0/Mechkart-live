"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddedShipFeeFromKg = embeddedShipFeeFromKg;
function embeddedShipFeeFromKg(weightKg) {
    const w = Math.max(0, Number(weightKg || 0));
    if (w <= 0)
        return 0;
    // 0.5kg => 60
    if (w <= 0.5)
        return 60;
    // every extra 0.5kg => +30
    const extraSlabs = Math.ceil((w - 0.5) / 0.5);
    return 60 + extraSlabs * 30;
}
