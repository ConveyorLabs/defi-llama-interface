import { BigNumber, ethers } from 'ethers';

import { chainsMap } from '../../constants';
import { sendTx } from '../../utils/sendTx';

export const name = 'Conveyor';
const baseUrl = 'https://api.conveyor.finance/';

export const native = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; //Burn address represents native token in the api

export const chainToId = {
	ethereum: 'ethereum',
	bsc: 'bsc',
	polygon: 'polygon',
	optimism: 'optimism',
	arbitrum: 'arbitrum',
	avax: 'avalanche',
	fantom: 'fantom'
};

const conveyorSwapAggregatorAddress = {
	1: '0x7B68636A43c9aC79fA0ef423d5094b291ffEFAb9', //Ref: https://etherscan.io/address/0x7B68636A43c9aC79fA0ef423d5094b291ffEFAb9#code
	56: '0xD9230DFA9ee25E007173C4b409F19B516b83066d', //Ref: https://bscscan.com/address/0xD9230DFA9ee25E007173C4b409F19B516b83066d#code
	137: '0x62eC8d2d797216b2f7784646d0646fe923461806', //Ref: https://polygonscan.com/address/0x62eC8d2d797216b2f7784646d0646fe923461806#code
	10: '0x91AE75251Bc0c6654EF0B327D190877B49b21A2E', //Ref: https://optimistic.etherscan.io/address/0x91AE75251Bc0c6654EF0B327D190877B49b21A2E#code
	42161: '0x85D6592B20a00551493B5264c3d42C0378c9800b', //Ref: https://arbiscan.io/address/0x85D6592B20a00551493B5264c3d42C0378c9800b#code
	43114: '0xBCbCF359E55EfA0bB9422C4a6aeCF7Ef7998898C', //Ref: https://cchain.explorer.avax.network/address/0xBCbCF359E55EfA0bB9422C4a6aeCF7Ef7998898C/contracts
	250: '0x5C5482520387E7B9875965fA1dA7888424b6c2E7' //Ref: https://ftmscan.com/address/0x5C5482520387E7B9875965fA1dA7888424b6c2E7#code
};

export async function getQuote(chain: string, from: string, to: string, amount: string, extra) {
	const chainId = chainsMap[chain];

	let tokenIn = isNativeToken(from) ? native : from;
	let tokenOut = isNativeToken(to) ? native : to;

	let router = conveyorSwapAggregatorAddress[chainId];

	const data = await fetch(`https://api.conveyor.finance/${chainToId[chain]}/`, {
		method: 'POST',
		body: JSON.stringify({
			token_in: tokenIn,
			token_out: tokenOut,
			amount_in: BigNumber.from(amount).toHexString(),
			chain_id: chainId,
			from_address: extra.userAddress ?? ethers.constants.AddressZero, //Pass the zero address if no address is connected to get a quote back from the saapi
			allowed_slippage: Number(extra.slippage) * 100 //Saapi expects slippage in Bips
		}),

		headers: {
			'Content-Type': 'application/json'
		}
	}).then((r) => r.json());

	let estimatedGas = data.gas_estimate;
	let value = isNativeToken(from) ? amount : 0;



	return {
		amountReturned: data.amount_out,
		amountIn: amount,
		estimatedGas,
		rawQuote: {
			...data,
			tx: {
				to: router,
				data: data.tx_calldata,
				gasLimit: calculateGasMargin(estimatedGas).toString(),
				value
			}
		},
		tokenApprovalAddress: router
	};
}

function isNativeToken(token: string): boolean {
	return token === ethers.constants.AddressZero;
}

function calculateGasMargin(value: string): BigNumber {
	return BigNumber.from(value).mul(120).div(100);
}

export async function swap({ signer, rawQuote, chain }) {
	const fromAddress = await signer.getAddress();
	const tx = await sendTx(signer, chain, {
		to: rawQuote.tx.to,
		from: fromAddress,
		data: rawQuote.tx.data,
		value: rawQuote.tx.value,
		gasLimit: rawQuote.tx.gasLimit
	});

	return tx;
}

export const getTxData = ({ rawQuote }) => rawQuote?.tx.data;

export const getTx = ({ rawQuote }) => rawQuote.tx;
