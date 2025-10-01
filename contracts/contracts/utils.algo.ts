import { biguint, BigUint, uint64 } from '@algorandfoundation/algorand-typescript'
import { Uint128, Uint64 } from '@algorandfoundation/algorand-typescript/arc4'

export function wideRatio(numeratorFactors: uint64[], denominatorFactors: uint64[]): uint64 {
    let numerator = new Uint128(1n)
    for (const factor of numeratorFactors) {
        numerator = new Uint128(BigUint(factor) * numerator.asBigUint())
    }

    let denominator = new Uint128(1n)
    for (const factor of denominatorFactors) {
        denominator = new Uint128(BigUint(factor) * denominator.asBigUint())
    }

    const ratio: biguint = numerator.asBigUint() / denominator.asBigUint()
    return new Uint64(ratio).asUint64()
}
