import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,measure} from '../src/tracking.mjs';
const point=(latitude,seconds,speed=10,accuracy=5,altitude=1000)=>({timestamp:seconds*1000,coords:{latitude,longitude:8,accuracy,speed,altitude}});
test('known distance and km/h conversion',()=>{assert(Math.abs(distanceKm(point(47,0).coords,point(48,0).coords)-111.195)<0.01);const result=measure(point(47,0),point(47.0002,2,10,5,1010));assert(result.km>0.02&&result.km<0.023);assert.equal(result.maxSpeed,36);assert.equal(result.ascent,10)});
test('rejects GPS jumps, bad accuracy, stale samples and stationary jitter',()=>{assert.equal(measure(point(47,0),point(48,2)),null);assert.equal(measure(point(47,0),point(47.0002,2,10,80)),null);assert.equal(measure(point(47,0),point(47.0002,50)),null);assert.equal(measure(point(47,0),point(47.000001,2)),null)});
test('missing or impossible speed is never a fabricated speed record',()=>{assert.equal(measure(point(47,0),point(47.0002,2,null)).maxSpeed,null);assert.equal(measure(point(47,0),point(47.0002,2,500)).maxSpeed,null)});
