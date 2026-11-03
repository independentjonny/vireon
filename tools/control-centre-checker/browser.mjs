import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { goalFundingReadModelFixture } from '../../__tests__/fixtures/goalFundingReadModel.ts';
import { fundingFixture } from '../../__tests__/fixtures/goalFunding.ts';
const out=process.env.VIREON_CHECKER_OUT;await fs.mkdir(out,{recursive:true});
const {facts,plan}=fundingFixture();
let saved={facts,plan,revision:'fixture-1',alternatives:[],history:[]},version=1;
const originalFacts=JSON.stringify(facts),writes=[],errors=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/goals/funding',async route=>{
  if(route.request().method()==='POST'){
    const body=route.request().postDataJSON();writes.push(body.action);assert.equal(body.expectedRevision,saved.revision);
    if(body.action==='alternative')saved.alternatives.unshift({id:'alternative-'+writes.length,name:body.name,plan:structuredClone(body.plan)});
    if(body.action==='adopt'){saved.history.unshift({id:'history-'+writes.length,name:'Prior active plan',plan:structuredClone(saved.plan)});saved.plan=structuredClone(body.plan);saved.revision='fixture-'+(++version);}
  }
  await route.fulfill({json:{ok:true,workspace:saved,position:goalFundingReadModelFixture("11111111-1111-4111-8111-111111111111").position}});
});
const url=process.env.VIREON_CHECKER_BASE;
async function ready(){await page.goto(url,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Review & adopt plan',exact:true}).waitFor();}
const selected=()=>page.getByLabel('Selected date comparison',{exact:true});
const today=()=>page.getByLabel('Today',{exact:true});

const geometrySamples=[];
async function captureGeometry(width){
 await page.setViewportSize({width,height:1100});await page.evaluate(()=>window.scrollTo(0,0));
 geometrySamples.push(await page.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,center:r.x+r.width/2,centerY:r.y+r.height/2}};
  const rows=[...document.querySelectorAll('.funding-metrics')].map(row=>[...row.children].map(box));
  const metrics=box(document.querySelector('.funding-take-control .funding-metrics')),slider=box(document.querySelector('.funding-slider-track input'));
  const dateBoxes=[...document.querySelectorAll('.control-time-controls input[type=date]')].map(box),left=Math.min(...dateBoxes.map(b=>b.x)),right=Math.max(...dateBoxes.map(b=>b.right));
  const dates={left,right,center:(left+right)/2,centerY:dateBoxes[0].centerY};
  const change=document.querySelector('.funding-change-goals'),changeBox=box(change);
  const marker=document.querySelector('.funding-retirement-marker'),bar=box(marker.querySelector('i')),label=box(marker.querySelector('span'));
  const track=box(document.querySelector('.funding-slider-track')),input=document.querySelector('.funding-slider-track input'),start=document.querySelector('.control-time-controls input[type=date]').value;
  const retirementDate=new Date(marker.dataset.retirementDate+'T00:00:00Z');
  const fraction=(retirementDate.getTime()-Date.parse(start))/86400000/Number(input.max);
  const expected=slider.x+6.5+(slider.width-13)*fraction;
  const clipped=[...document.querySelectorAll('.funding-state-row h2,.funding-state-row h3,.funding-state-row strong,.funding-state-row input')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.x<0||r.right>innerWidth+1||el.scrollWidth>el.clientWidth+1)}).map(el=>el.textContent||el.getAttribute('aria-label')||el.tagName);
  const rgb=value=>value.match(/[\d.]+/g)?.map(Number)??[];
  const luminance=values=>{const c=values.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
  const contrast=[...document.querySelectorAll('.funding-state-row h2,.funding-state-row h3,.funding-state-row strong,.funding-state-row p,.funding-state-row a,.funding-state-row label,.funding-state-row summary')].filter(el=>el.getClientRects().length&&el.textContent.trim()).map(el=>{let parent=el,bg;while(parent){const color=rgb(getComputedStyle(parent).backgroundColor);if(color.length===3||color[3]===1){bg=color;break}parent=parent.parentElement}const text=luminance(rgb(getComputedStyle(el).color)),background=luminance(bg??[255,255,255]);return {label:el.textContent.slice(0,70),ratio:(Math.max(text,background)+.05)/(Math.min(text,background)+.05)}});
  const wrappedValues=[...document.querySelectorAll('.funding-state-row .workspace-metric>strong')].filter(el=>el.textContent.includes(String.fromCharCode(36))&&el.getBoundingClientRect().height>parseFloat(getComputedStyle(el).lineHeight)+1).map(el=>el.textContent);
  const textBounds=el=>{const range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect()};
  const positionOverlaps=[...document.querySelectorAll('.financial-position-summary-header')].filter(header=>{const a=textBounds(header.children[0]),b=textBounds(header.children[1]);return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1}).map(header=>header.textContent);
  const positionClipped=[...document.querySelectorAll('#financial-position article h2,#financial-position article strong,.financial-position-net-value')].filter(el=>{const text=textBounds(el),card=el.closest('article').getBoundingClientRect();return text.left<card.left+8||text.right>card.right-8}).map(el=>el.textContent);
  return {positionOverlaps,positionClipped,wrappedValues,contrast,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,rows,metrics,slider,dates,changeGoals:{role:change.tagName,right:changeBox.right,centerY:changeBox.centerY},marker:{horizontal:bar.width>bar.height*5,aboveSlider:bar.bottom<=slider.y+3,labelInside:label.x>=0&&label.right<=innerWidth,positionError:Math.abs(bar.center-expected),track},clipped};
 }));
}

try{
await ready();assert.equal(await page.locator('.funding-metrics .workspace-metric').count(),12);
await page.getByRole('heading',{name:'Current State',exact:true}).waitFor();await page.getByRole('heading',{name:'Take Control',exact:true}).waitFor();assert.equal(await page.locator('.funding-retirement-marker').count(),1);
await page.locator('.funding-state-row').first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/desktop.png'});
const geometry=await page.locator('.funding-metrics').evaluateAll(rows=>rows.map(row=>[...row.children].map(card=>{const r=card.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}))); for(const row of geometry){assert.equal(row.length,4);row.forEach((card,i)=>{assert.ok(Math.abs(card.x-geometry[0][i].x)<1);assert.ok(Math.abs(card.width-geometry[0][i].width)<1);assert.ok(Math.abs(card.y-row[0].y)<1);});} await fs.writeFile(out+'/desktop-geometry.json',JSON.stringify(geometry,null,2)); await captureGeometry(1440);await captureGeometry(1280);await page.setViewportSize({width:1440,height:1100}); const confirmed=await today().innerText();assert.match(confirmed,/140,000/);assert.match(confirmed,/2,000/);
assert.equal(await page.getByRole('link',{name:'Control Centre',exact:true}).count(),1);assert.equal(await page.getByRole('link',{name:'Dashboard_Old',exact:true}).count(),0);
await page.getByText('Time frame options & assumptions',{exact:true}).click();
console.log('Desktop comparison and funding alternatives');
await page.getByRole('link',{name:'Change goals',exact:true}).click();assert.equal(new URL(page.url()).hash,'#funding-goals');
await page.getByRole('button',{name:'Preview use savings',exact:true}).click();
await page.getByRole('button',{name:'Preview split funding',exact:true}).click();
await page.getByRole('button',{name:'Preview save first',exact:true}).click();
assert.equal(await page.getByLabel('Use all available monthly surplus for this goal',{exact:true}).isChecked(),true);
await page.getByRole('button',{name:'Preview use offset',exact:true}).click();
const previewGoalDate=await page.getByLabel('Payment date',{exact:true}).inputValue();await page.getByRole('button',{name:'Preview funding',exact:true}).click();
await page.getByLabel('Selected endpoint',{exact:true}).fill('2028-11-03');assert.equal(await today().innerText(),confirmed);
assert.match(await selected().textContent(),/Current plan/);assert.match(await selected().textContent(),/Proposed plan/);
await page.getByLabel('Chart measure',{exact:true}).selectOption('mortgageBalance');await page.getByLabel('Chart measure',{exact:true}).selectOption('availableCash');
await page.getByRole('button',{name:'Goal payment',exact:true}).click();assert.equal(await page.getByLabel('Selected endpoint',{exact:true}).inputValue(),previewGoalDate);
await page.getByRole('button',{name:'Five years',exact:true}).click();assert.equal(await page.getByLabel('Selected endpoint',{exact:true}).inputValue(),'2031-11-03');
await page.getByLabel('Selected period in days',{exact:true}).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal(await page.getByLabel('Selected endpoint',{exact:true}).inputValue(),'2026-11-04');
await page.getByLabel('Period start',{exact:true}).fill('2028-11-03');await page.getByRole('alert').first().waitFor();assert.equal(await today().innerText(),confirmed);
await page.getByLabel('Period start',{exact:true}).fill('2026-11-03');await page.getByLabel('Selected endpoint',{exact:true}).fill('2028-11-03');
await page.screenshot({path:out+'/desktop-comparison.png',fullPage:true});
console.log('Save alternative, cancel adoption, adopt, reload and recover');
await page.getByLabel('Alternative name',{exact:true}).fill('Offset option');await page.getByRole('button',{name:'Save alternative',exact:true}).click();await page.getByRole('status').filter({hasText:'Alternative saved'}).waitFor();
assert.equal(saved.plan.goals[0].funding.sources[0].accountId,'savings');assert.equal(saved.alternatives.length,1);
await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Review & adopt plan',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Review & adopt plan',exact:true}).isDisabled(),true);
await page.getByLabel('Load saved alternative or prior plan',{exact:true}).selectOption({label:'Offset option'});
await page.getByRole('button',{name:'Review & adopt plan',exact:true}).click();await page.screenshot({path:out+'/adoption-review.png'}); await page.getByRole('button',{name:'Cancel adoption',exact:true}).click();assert.deepEqual(writes,['alternative']);
await page.getByRole('button',{name:'Review & adopt plan',exact:true}).click();await page.getByRole('button',{name:'Adopt this plan',exact:true}).click();await page.getByRole('status').filter({hasText:'Plan adopted'}).waitFor();assert.equal(saved.plan.goals[0].funding.sources[0].accountId,'offset');assert.equal(saved.history.length,1);assert.equal(JSON.stringify(saved.facts),originalFacts);
await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Review & adopt plan',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Review & adopt plan',exact:true}).isDisabled(),true);
await page.getByLabel('Load saved alternative or prior plan',{exact:true}).selectOption({label:'Recover: Prior active plan'});assert.equal(await page.getByRole('button',{name:'Review & adopt plan',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Reset preview',exact:true}).click();
console.log('Add/edit/cancel goal and replenishment');
await page.getByRole('button',{name:'Add goal',exact:true}).click();await page.getByLabel('Goal title',{exact:true}).fill('Holiday');await page.getByLabel('Target cost ($)',{exact:true}).fill('3000');await page.getByLabel('Payment date',{exact:true}).fill('2028-11-03');await page.getByLabel('Funding from Savings',{exact:true}).fill('3000');
await page.getByLabel('Replenish withdrawn cash after payment',{exact:true}).check();await page.getByLabel('Monthly replenishment ($)',{exact:true}).fill('250');await page.getByLabel('Replenishment destination',{exact:true}).selectOption('savings');await page.getByLabel('Replenishment start date',{exact:true}).fill('2028-11-04');
await page.getByRole('button',{name:'Cancel goal edits',exact:true}).click();assert.equal(await page.getByLabel('Selected goal',{exact:true}).locator('option',{hasText:'Holiday'}).count(),0);
for(const width of [390,320]){
  console.log('Mobile',width);await captureGeometry(width);await page.setViewportSize({width,height:844});
  await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();const menu=page.getByRole('dialog',{name:'Navigation',exact:true});assert.equal(await menu.getByRole('link',{name:'Control Centre',exact:true}).count(),1);assert.equal(await menu.getByRole('link',{name:'Dashboard_Old',exact:true}).count(),0);await page.keyboard.press('Escape');
  await page.getByLabel('Selected goal',{exact:true}).selectOption('a-goal');await page.getByLabel('Target cost ($)',{exact:true}).fill('15000');await page.getByLabel('Funding from Savings',{exact:true}).fill('5000');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+`/mobile-${width}-funding.png`,fullPage:true});
  await page.getByRole('button',{name:'Review & adopt plan',exact:true}).click(); const review=page.getByRole('dialog',{name:'Review plan adoption',exact:true}); await review.waitFor(); const box=await review.boundingBox();assert.ok(box.x>=15 && box.x+box.width<=width-15); for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await review.evaluate(el=>el.contains(document.activeElement)),true);} await page.screenshot({path:out+'/mobile-'+width+'-review.png'});await page.getByRole('button',{name:'Cancel adoption',exact:true}).click(); await page.getByRole('button',{name:'Cancel goal edits',exact:true}).click();await page.getByRole('button',{name:'Reset preview',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('heading',{name:'Control Centre',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:out+`/mobile-${width}.png`,fullPage:true});
}
console.log('Missing data and retirement-review state');
saved.facts.accounts[0].annualRate=null;await page.reload({waitUntil:'networkidle'});await page.getByText('Time frame options & assumptions',{exact:true}).click();await page.getByRole('button',{name:'Shared assumptions',exact:true}).waitFor();assert.match(await selected().innerText(),/Unavailable/);
await page.getByRole('button',{name:'Shared assumptions',exact:true}).click();await page.getByText('Account interest and offset linkage',{exact:true}).click();
const savings=page.getByRole('group',{name:/Savings · confirmed balance/});await savings.getByLabel('Account interest (%/year)',{exact:true}).fill('0');
await page.getByLabel('Retirement state',{exact:true}).selectOption('true');await page.getByLabel('Retirement-review date',{exact:true}).fill('2027-11-03');await page.getByRole('heading',{name:'Retirement',exact:true}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);assert.deepEqual(writes,['alternative','adopt']);
await fs.writeFile(out+'/browser-results.json',JSON.stringify({passed:true,fixtureOnly:true,authenticatedAccount:false,widths:[1440,390,320],checks:['12 metrics in exactly three main rows','current vs proposed values','savings/offset/split/Save first controls','slider and exact dates','reversed dates preserve Today','chart switching and textual events','add/edit/cancel goal','replenishment controls','alternative save leaves active plan unchanged','review/cancel/adopt','reload and recovery','missing rates and confirmed zero','already-retired future review','no horizontal overflow','no page exceptions'],writes},null,2));

// Real dashboard integration: Financial Position follows Control Centre; next step is last.
await page.getByRole('heading',{name:'Control Centre',exact:true}).click();
const order=await page.evaluate(()=>{const centre=document.querySelector('.funding-centre'),position=document.querySelector('#financial-position'),next=document.querySelector('.workspace-priority');return {positionAfter:!!(centre.compareDocumentPosition(position)&Node.DOCUMENT_POSITION_FOLLOWING),last:next===document.querySelector('main.workspace-dashboard').lastElementChild}});assert.equal(order.positionAfter,true);assert.equal(order.last,true);
assert.equal(await page.getByRole('link',{name:'Overview',exact:true}).count(),0);

// Check realistic large balances, explicit zero and unknown without conflating them.
saved.facts.accounts[0].annualRate=4;saved.facts.otherAssets=20000000;
await ready();await captureGeometry(320);assert.match(await today().innerText(),/19,940,000/);await page.locator('.funding-centre').screenshot({path:out+'/large-values-320.png'});
saved.facts.otherAssets=0;saved.facts.otherLiabilities=0;saved.facts.income=0;saved.facts.livingExpenses=0;saved.facts.essentialExpenses=0;for(const account of saved.facts.accounts)account.balance=0;for(const loan of saved.facts.loans)loan.balance=0;
await ready();assert.equal(await today().locator('.workspace-metric').nth(0).locator('strong').first().innerText(),'$0');assert.equal(await today().locator('.workspace-metric').nth(2).locator('strong').first().innerText(),'$0');await captureGeometry(320);
saved.facts.otherAssets=null;for(const account of saved.facts.accounts)account.balance=null;
await ready();assert.equal(await today().locator('.workspace-metric').nth(0).locator('strong').first().innerText(),'Unavailable');assert.equal(await today().locator('.workspace-metric').nth(2).locator('strong').first().innerText(),'Unavailable');await captureGeometry(320);

// Legacy hosted accounts have cash flow but incomplete loan/account modelling metadata.
saved=structuredClone({facts:fundingFixture().facts,plan:fundingFixture().plan,revision:'legacy',alternatives:[],history:[]});
saved.facts.confirmedMonthlySurplus=2000;saved.facts.confirmedKnownNetPosition=140000;
saved.facts.accounts[0].annualRate=null;saved.facts.loans[0].remainingMonths=null;
saved.plan.goals=[];saved.plan.assumptions.settlementAccountId=null;
saved.plan.assumptions.retirementDate='2040-11-03';saved.plan.assumptions.retirementIncome=2000;saved.plan.assumptions.retirementSpending=1500;
await page.setViewportSize({width:1440,height:1100});await ready();
await page.getByText('Cash-flow preview from your current settings',{exact:true}).waitFor();
assert.match(await selected().innerText(),/160,000/);assert.doesNotMatch(await selected().innerText(),/Unavailable/);
await page.getByLabel('Selected endpoint',{exact:true}).fill('2027-11-03');assert.match(await selected().innerText(),/64,000/);
assert.match(await page.getByLabel('Retirement comparison',{exact:true}).innerText(),/500/);
await page.screenshot({path:out+'/legacy-cash-flow-preview.png'});
await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:out+'/legacy-cash-flow-preview-mobile.png'});

let retirementWrite=null;
await page.route('**/api/financial-setup',async route=>{retirementWrite=route.request().postDataJSON();await route.fulfill({json:{ok:true,retirementGoals:retirementWrite.settings}})});
await page.goto(url+'/goals',{waitUntil:'networkidle'});
const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Retirement date, income & expenses',exact:true})});
await form.getByLabel('Retirement date',{exact:true}).fill('2040-11-03');await form.getByLabel('Retirement income ($/month)',{exact:true}).fill('2000');await form.getByLabel('Retirement expenses ($/month)',{exact:true}).fill('1500');await form.getByRole('button',{name:'Save retirement goals',exact:true}).click();await form.getByRole('status').filter({hasText:'Retirement goals saved'}).waitFor();assert.deepEqual(retirementWrite,{action:'save-retirement-goals',settings:{retirementDate:'2040-11-03',monthlyIncome:2000,monthlyExpenses:1500}});await form.screenshot({path:out+'/goals-retirement.png'});
assert.deepEqual(errors,[]);
await fs.writeFile(out+'/ui.json',JSON.stringify({passed:true,geometry:geometrySamples,fixtureOnly:true,authenticatedBrowser:false,confirmedFactsUnchanged:true,writes,order,retirementWrite},null,2));

console.log('Funding desktop/mobile fixture journey passed.');
}catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
