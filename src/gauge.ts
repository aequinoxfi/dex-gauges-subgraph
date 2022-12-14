import { ZERO_ADDRESS } from './utils/constants';
import { getGaugeShare, getRewardToken } from './utils/gauge';
import { scaleDown, scaleDownBPT } from './utils/maths';
import { Gauge, LiquidityGauge, Pool } from './types/schema';

import {
  Transfer,
  // eslint-disable-next-line camelcase
  Deposit_reward_tokenCall,
  KillGaugeCall,
  UnkillGaugeCall,
} from './types/templates/LiquidityGauge/LiquidityGauge';

// eslint-disable-next-line camelcase
export function handleDepositRewardToken(call: Deposit_reward_tokenCall): void {
  /* eslint-disable no-underscore-dangle */
  const address = call.inputs._reward_token;
  const amount = call.inputs._amount;
  /* eslint-enable no-underscore-dangle */

  const rewardToken = getRewardToken(address, call.to);
  const amountScaled = scaleDown(amount, rewardToken.decimals);
  rewardToken.totalDeposited = rewardToken.totalDeposited.plus(amountScaled);
  rewardToken.save();
}

export function handleTransfer(event: Transfer): void {
  let gaugeAddress = event.address;

  let gauge = LiquidityGauge.load(gaugeAddress.toHexString()) as LiquidityGauge;

  /* eslint-disable no-underscore-dangle */
  let fromAddress = event.params._from;
  let toAddress = event.params._to;
  let value = event.params._value;
  /* eslint-enable no-underscore-dangle */

  let isMint = fromAddress.toHexString() == ZERO_ADDRESS;
  let isBurn = toAddress.toHexString() == ZERO_ADDRESS;
  let scaledDownValue = scaleDownBPT(value);

  if (isMint) {
    let userShareTo = getGaugeShare(toAddress, gaugeAddress);
    userShareTo.balance = userShareTo.balance.plus(scaledDownValue);
    userShareTo.save();
    gauge.totalSupply = gauge.totalSupply.plus(scaledDownValue);
  } else if (isBurn) {
    let userShareFrom = getGaugeShare(fromAddress, gaugeAddress);
    userShareFrom.balance = userShareFrom.balance.minus(scaledDownValue);
    userShareFrom.save();
    gauge.totalSupply = gauge.totalSupply.minus(scaledDownValue);
  } else {
    let userShareTo = getGaugeShare(toAddress, gaugeAddress);
    userShareTo.balance = userShareTo.balance.plus(scaledDownValue);
    userShareTo.save();

    let userShareFrom = getGaugeShare(fromAddress, gaugeAddress);
    userShareFrom.balance = userShareFrom.balance.minus(scaledDownValue);
    userShareFrom.save();
  }

  gauge.save();
}

export function handleKillGauge(call: KillGaugeCall): void {
  // eslint-disable-next-line no-underscore-dangle
  let killedGaugeId = call.to.toHexString();
  let killedGauge = LiquidityGauge.load(killedGaugeId);
  if (killedGauge == null) return;
  killedGauge.isKilled = true;
  killedGauge.isPreferentialGauge = false;
  killedGauge.save();

  // Update Pool's preferentialGauge

  let poolId = killedGauge.pool;
  if (poolId === null) return;

  let pool = Pool.load(poolId);
  if (pool == null) return;

  let currentPreferentialGaugeId = pool.preferentialGauge;

  if (
    currentPreferentialGaugeId &&
    currentPreferentialGaugeId == killedGaugeId
  ) {
    pool.preferentialGauge = '';

    let preferencialGaugeTimestamp = 0;
    for (let i: i32 = 0; i < pool.gaugesList.length; i++) {
      if (currentPreferentialGaugeId == pool.gaugesList[i].toHex()) continue;

      let liquidityGauge = LiquidityGauge.load(
        pool.gaugesList[i].toHex(),
      ) as LiquidityGauge;

      let gaugeId = liquidityGauge.gauge;
      if (gaugeId === null) continue; // Gauge not added to GaugeController

      let gauge = Gauge.load(gaugeId) as Gauge;

      if (
        !liquidityGauge.isKilled &&
        gauge.addedTimestamp > preferencialGaugeTimestamp
      ) {
        pool.preferentialGauge = liquidityGauge.id;
        preferencialGaugeTimestamp = gauge.addedTimestamp;
      }
    }
  }

  pool.save();

  let poolPreferentialGauge = pool.preferentialGauge;
  if (poolPreferentialGauge === null) return;

  let preferentialGauge = LiquidityGauge.load(poolPreferentialGauge);
  if (preferentialGauge == null) return;

  preferentialGauge.isPreferentialGauge = true;
  preferentialGauge.save();
}

export function handleUnkillGauge(call: UnkillGaugeCall): void {
  // eslint-disable-next-line no-underscore-dangle
  let unkilledLiquidityGaugeId = call.to.toHexString();
  let unkilledLiquidityGauge = LiquidityGauge.load(unkilledLiquidityGaugeId);
  if (unkilledLiquidityGauge == null) return;
  unkilledLiquidityGauge.isKilled = false;
  unkilledLiquidityGauge.save();

  let unkilledGaugeId = unkilledLiquidityGauge.gauge;
  if (unkilledGaugeId === null) return; // Gauge not added to GaugeController

  // Update Pool's preferentialGauge

  let poolId = unkilledLiquidityGauge.pool;
  if (poolId === null) return;
  let pool = Pool.load(poolId);
  if (pool == null) return;

  let preferentialGaugeId = pool.preferentialGauge;
  if (preferentialGaugeId === null) {
    pool.preferentialGauge = unkilledLiquidityGaugeId;
    pool.save();

    unkilledLiquidityGauge.isPreferentialGauge = true;
    unkilledLiquidityGauge.save();

    return;
  }

  let preferentialGauge = LiquidityGauge.load(
    preferentialGaugeId,
  ) as LiquidityGauge;

  let currentPreferentialGaugeId = preferentialGauge.gauge;
  if (currentPreferentialGaugeId === null) {
    pool.preferentialGauge = unkilledLiquidityGaugeId;
    pool.save();

    unkilledLiquidityGauge.isPreferentialGauge = true;
    unkilledLiquidityGauge.save();

    return;
  }

  let unkilledGauge = Gauge.load(unkilledGaugeId) as Gauge;
  let currentPreferentialGauge = Gauge.load(
    currentPreferentialGaugeId,
  ) as Gauge;

  if (unkilledGauge.addedTimestamp > currentPreferentialGauge.addedTimestamp) {
    pool.preferentialGauge = unkilledLiquidityGaugeId;
    pool.save();

    unkilledLiquidityGauge.isPreferentialGauge = true;
    unkilledLiquidityGauge.save();

    let currentPreferentialLiquidityGaugeId =
      currentPreferentialGauge.liquidityGauge;
    if (currentPreferentialLiquidityGaugeId) {
      let currentPreferentialLiquidityGauge = LiquidityGauge.load(
        currentPreferentialLiquidityGaugeId,
      ) as LiquidityGauge;
      currentPreferentialLiquidityGauge.isPreferentialGauge = false;
      currentPreferentialLiquidityGauge.save();
    }
  }
}
