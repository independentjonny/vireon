import { expect, test } from "playwright/test";

test("invitation approval uses an in-page note and one acknowledged request", async ({page}) => {
  let approved = false, writes = 0, nativeDialog = false;
  page.on("dialog", async dialog => { nativeDialog = true; await dialog.dismiss(); });
  await page.route("**/api/admin/private-beta/access-requests**", async route => {
    if (route.request().method() === "GET") return route.fulfill({json:{ok:true,requests:approved ? [] : [{id:"synthetic-request",email:"qa@example.test",displayName:"Synthetic QA",reason:"Synthetic test",status:"pending"}]}});
    writes++;
    expect(route.request().url()).toContain("/synthetic-request/approve");
    expect(route.request().postDataJSON()).toEqual({reason:"Disposable QA test account"});
    approved = true;
    return route.fulfill({json:{ok:true,invitationUrl:"https://example.test/login/redeem-invitation?token=synthetic-only"}});
  });
  await page.goto("/admin/private-beta/access");
  await page.getByRole("button",{name:"Approve",exact:true}).click();
  expect(writes).toBe(0);
  const form=page.getByRole("form",{name:"Approve access request"});
  await expect(form.getByRole("button",{name:"Approve invitation",exact:true})).toBeDisabled();
  await form.getByLabel("Approval note").fill("Disposable QA test account");
  await form.getByRole("button",{name:"Approve invitation",exact:true}).click();
  await expect(page.getByText("Sensitive one-time invitation link",{exact:true})).toBeVisible();
  await expect(page.getByText("No pending access requests.",{exact:true})).toBeVisible();
  expect(writes).toBe(1);
  expect(nativeDialog).toBe(false);
});

test("cancel does not submit and failed approval retains its note",async({page})=>{
  let writes=0;
  await page.route("**/api/admin/private-beta/access-requests**",async route=>{
    if(route.request().method()==="GET") return route.fulfill({json:{ok:true,requests:[{id:"synthetic-request",email:"qa@example.test",reason:"Synthetic test",status:"pending"}]}});
    writes++;
    return route.fulfill({status:503,json:{ok:false,error:"Approval service unavailable. Try again."}});
  });
  await page.goto("/admin/private-beta/access");
  await page.getByRole("button",{name:"Approve",exact:true}).click();
  await page.getByRole("form",{name:"Approve access request"}).getByRole("button",{name:"Cancel",exact:true}).click();
  expect(writes).toBe(0);
  await page.getByRole("button",{name:"Approve",exact:true}).click();
  await page.getByLabel("Approval note").fill("Keep this QA note");
  await page.getByRole("button",{name:"Approve invitation",exact:true}).click();
  await expect(page.getByText("Approval service unavailable. Try again.",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Approval note")).toHaveValue("Keep this QA note");
  expect(writes).toBe(1);
});
