/* eslint-disable @typescript-eslint/no-explicit-any */

import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client'
import { describe, expect, it } from 'vitest'
import stakingPoolTealScript from './contracts/tealscript_artifacts/StakingPool.arc56.json'
import validatorRegistryTealScript from './contracts/tealscript_artifacts/ValidatorRegistry.arc56.json'
import stakingPoolPuya from './contracts/artifacts/StakingPool.arc56.json'
import validatorRegistryPuya from './contracts/artifacts/ValidatorRegistry.arc56.json'
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client'
import { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import * as fs from 'fs'

async function testBytecodeComparison(
    puyaSpec: Arc56Contract,
    tealScriptSpec: Arc56Contract,
    puyaDeployParams: Record<string, any>,
    tealScriptDeployParams: Record<string, any>,
    contractName: string,
) {
    const algorand = AlgorandClient.defaultLocalNet()
    const defaultSender = await algorand.account.localNetDispenser()

    const puyaClient = new AppClient({
        appId: 0n,
        appSpec: puyaSpec,
        algorand,
        defaultSender,
    })

    const puyaResult = await puyaClient.compile({
        deployTimeParams: puyaDeployParams,
    })

    const tealScriptClient = new AppClient({
        appId: 0n,
        appSpec: tealScriptSpec,
        algorand,
        defaultSender,
    })

    if (!tealScriptSpec.source?.approval) {
        throw new Error('TealScript source code not found')
    }

    if (!puyaSpec.source?.approval) {
        throw new Error('Puya source code not found')
    }

    const tealscriptTeal = atob(tealScriptSpec.source.approval)
    const puyaTeal = atob(puyaSpec.source.approval)

    // write TEAL to file
    fs.writeFileSync(`test_artifacts/tealscript-${tealScriptSpec.name}.teal`, tealscriptTeal)
    fs.writeFileSync(`test_artifacts/puya-${puyaSpec.name}.teal`, puyaTeal)

    const tealScriptResult = await tealScriptClient.compile({
        deployTimeParams: tealScriptDeployParams,
    })

    const tealscriptSize = tealScriptResult.approvalProgram.length
    const puyaSize = puyaResult.approvalProgram.length

    console.debug(`${contractName} - Puya bytecode size:`, puyaSize)
    console.debug(`${contractName} - TealScript bytecode size:`, tealscriptSize)

    // Print percentage
    console.debug(
        `${contractName} - Puya bytecode is ${((puyaSize / tealscriptSize) * 100).toFixed(2)}% of TealScript bytecode (NOTE: This does not account for the fact that the Puya wideRatio is not equal to TEALScripts and is less bytecode but more expensive)`,
    )

    const disassembledTealscript = (await algorand.client.algod.disassemble(tealScriptResult.approvalProgram).do())
        .result
    const disassembledPuya = (await algorand.client.algod.disassemble(puyaResult.approvalProgram).do()).result

    fs.writeFileSync(`test_artifacts/tealscript-${tealScriptSpec.name}.disassembled.teal`, disassembledTealscript)
    fs.writeFileSync(`test_artifacts/puya-${puyaSpec.name}.disassembled.teal`, disassembledPuya)

    expect(puyaSize).toBeLessThanOrEqual(tealscriptSize)
    expect(puyaSize).toMatchSnapshot(`${contractName}-bytecode-size`)
}

describe('StakingPoolClient', () => {
    it('bytecode is smaller or equal to TEALScript', async () => {
        const algorand = AlgorandClient.defaultLocalNet()

        await testBytecodeComparison(
            // @ts-expect-error: JSON import
            stakingPoolPuya,
            stakingPoolTealScript,
            { NFD_REGISTRY_APP_ID: 0, FEE_SINK_ADDR: algorand.account.random().publicKey },
            { nfdRegistryAppId: 0, feeSinkAddr: algorand.account.random().publicKey },
            'StakingPool',
        )
    })
})

describe('ValidatorRegistryClient', () => {
    it('bytecode is smaller or equal to TEALScript', async () => {
        await testBytecodeComparison(
            // @ts-expect-error: JSON import
            validatorRegistryPuya,
            validatorRegistryTealScript,
            { NFD_REGISTRY_APP_ID: 0 },
            { nfdRegistryAppId: 0 },
            'ValidatorRegistry',
        )
    })
})
