import {test,expect} from "@playwright/test";
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe("jornada em " + viewport.width + "px", () => {
    test.use({ viewport });
test("calcula salário e registra histórico local",async({page})=>{
 await page.goto("./");
 await page.locator("#salario").fill("350000");
 await page.getByRole("button",{name:"Calcular",exact:true}).click();
 await expect(page.locator("#res-bruto")).toContainText("3.500");
 await expect(page.locator("#historico li")).toHaveCount(1);
});

  });
}
