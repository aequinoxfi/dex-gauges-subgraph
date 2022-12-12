import { Address, log } from '@graphprotocol/graph-ts';

import { GaugeCreated } from './types/GaugeFactory/GaugeFactory';
import { GaugeFactory } from './types/schema';
import { getLiquidityGauge } from './utils/gauge';

import { LiquidityGauge as LiquidityGaugeTemplate } from './types/templates';

import { getPoolEntity, getPoolId, isPoolRegistered } from './utils/misc';
import { LiquidityGauge } from './types/GaugeFactory/LiquidityGauge';

function getGaugeFactory(address: Address): GaugeFactory {
  let factory = GaugeFactory.load(address.toHexString());

  if (factory == null) {
    factory = new GaugeFactory(address.toHexString());
    factory.numGauges = 0;
    factory.save();
  }

  return factory;
}

export function handleLiquidityGaugeCreated(event: GaugeCreated): void {
  const gaugeAddress = event.params.gauge;
  let factory = getGaugeFactory(event.address);
  factory.numGauges += 1;
  factory.save();

  const gaugeContract = LiquidityGauge.bind(gaugeAddress);
  const lpTokenCall = gaugeContract.try_lp_token();
  if (lpTokenCall.reverted) {
    log.warning('Call to lp_token() failed: {} {}', [
      gaugeAddress.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }

  const poolAddress = lpTokenCall.value;
  const poolRegistered = isPoolRegistered(poolAddress);

  if (poolRegistered) {
    getPoolEntity(lpTokenCall.value, gaugeAddress);
  }

  let gauge = getLiquidityGauge(gaugeAddress, poolAddress);
  // gauge.poolAddress = event.params.pool;
  gauge.pool = poolRegistered ? poolAddress.toHexString() : null;
  gauge.poolId = poolRegistered ? getPoolId(poolAddress) : null;
  gauge.factory = factory.id;
  gauge.save();

  LiquidityGaugeTemplate.create(gaugeAddress);
}
