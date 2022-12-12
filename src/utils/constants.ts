import { Address, BigInt, dataSource } from '@graphprotocol/graph-ts';

export const ZERO = BigInt.fromI32(0);
export const ONE = BigInt.fromI32(1);
export const ZERO_BD = ZERO.toBigDecimal();
export const ONE_BD = ZERO.toBigDecimal();

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export class AddressByNetwork {
  public mainnet: string;
  public goerli: string;
  public bsc: string;
}

let controllerAddressByNetwork: AddressByNetwork = {
  mainnet: '',
  goerli: '0x2ee2f54e95ce6f24dAdbDfa8221a6F763E8eEB96',
  bsc: '',
};

let vaultAddressByNetwork: AddressByNetwork = {
  mainnet: '',
  goerli: '0x84259CbD70aA17EB282Cb40666d2687Cd8E100AA',
  bsc: '',
};

let network: string = dataSource.network();

function forNetwork(
  addressByNetwork: AddressByNetwork,
  network: string,
): Address {
  if (network == 'mainnet') {
    return Address.fromString(addressByNetwork.mainnet);
  } else if (network == 'goerli') {
    return Address.fromString(addressByNetwork.goerli);
  } else {
    return Address.fromString(addressByNetwork.bsc);
  }
}

export const CONTROLLER_ADDRESS = forNetwork(
  controllerAddressByNetwork,
  network,
);

export let VAULT_ADDRESS = forNetwork(vaultAddressByNetwork, network);
