import assert from "node:assert/strict";
import { it } from "node:test";
import { wealthTrajectory, validateTrajectory, type TrajectorySettings } from "../../src/lib/wealthTrajectory.ts";
const s:TrajectorySettings={currentAge:60,retirementAge:62,annualAddition:1000,low:0,base:10,high:20,inflation:0,complete:true};
it("compounds net wealth with year-end additions and respects retirement age",()=>{const p=wealthTrajectory(10000,s);assert.equal(p.length,3);assert.ok(Math.abs(p[2].base-14200)<0.001);assert.equal(p[2].low,12000);assert.equal(p[2].high,16600);assert.equal(p[2].age,62);});
it("adjusts the base illustration for inflation",()=>{const p=wealthTrajectory(10000,{...s,inflation:10});assert.ok(Math.abs(p[2].realBase-14200/1.21)<0.001);});
it("rejects incomplete assumptions, invalid ages, rates and negative starting wealth",()=>{for(const patch of [{complete:false},{currentAge:62},{retirementAge:101},{base:NaN},{low:15},{inflation:-1}])assert.throws(()=>validateTrajectory({...s,...patch}));assert.throws(()=>wealthTrajectory(-1,s));});
