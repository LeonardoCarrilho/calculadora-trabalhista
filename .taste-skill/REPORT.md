GATE: OPEN 60 (rounds used up)

# Revisão final da interface

Refs #6; continuação do PR #4. Sem merge ou publicação.

A composição preserva a ferramenta operacional, os campos e os resultados reais. O [plano](PLAN.md) registra a identidade, o deal e suas adaptações. A UI não recebeu fotografias, mockups, estatísticas ou depoimentos inventados. Não há fatos assumidos nem marca nova.

## Evidências

- Antes: [desktop](../docs/redesign-before.png), 1440×2284; baseline do main anterior à integração.
- Depois: [desktop](../docs/preview.png), 1440×2544; [mobile](../docs/preview-mobile.png), 390×4437.
- Capturas finais inspecionadas visualmente. Não há baseline mobile, gate anterior ao redesign ou medição comparável de performance; não inferimos melhoria numérica. Altura total é dimensão da captura, não nota de qualidade. Câmbio e clima usam dados externos, que podem variar entre capturas.
- 24 testes unitários/cobertura passaram na integração. CI com E2E em 320, 390, 768, 820, 1024 e 1440px passou no commit b09d84f: [execução](https://github.com/LeonardoCarrilho/calculadora-trabalhista/actions/runs/43126686657). Os checks incluem CSP e fluxo existente.
- npm audit: zero vulnerabilidades após overrides restritos de test-exclude; não houve mudança nas regras de negócio. Build e lint passaram. Os dois últimos ajustes são CSS de foco; o gate final exercitou Tab.

## Gate e limites

Todos os 63 FAILs abertos, 16 WARNs e suas localizações estão no [registro integral](findings.json). A validação não é PASS. As exigências de seções fullscreen, CTA promocional por seção, fotografia/mockup e momentos de demonstração são incompatíveis com a manutenção destas ferramentas. Elas continuam abertas, sem isenções genéricas. Alinhamentos sinalizados em painéis, subtítulos e tabelas foram confrontados com as capturas.

Achados finais de foco, contraste, toque, colisão, overflow de página e entrada: [{"check":"focus-visible","where":"input#vt","msg":"Tab stop 7, input \"\": its focus change is faint: 1.15:1 against the ground, 3:1 needed"}].

Os WARNs de copy permanecem no registro: rótulos curtos de ações existentes e títulos informativos em português não foram convertidos em copy de venda. Não foram executados novos perfis de performance. Estados de erro, vazio, armazenamento e ações têm testes, mas não possuem captura anterior comparável.

## Isenções específicas

- **gaming-suspect**, dist/assets/index-: The bundled code is the unchanged taste-skill motion.js shot() check for HeadlessChrome; its own documented screenshot behavior, not application checker detection.
- **motion-layer**, html[data-motion]: Vite bundles the unchanged taste-skill motion.css into the generated CSS asset. Source index.html imports it and the built CSS contains the motion layer.
- **nav**, header.site-header > div.wrap.header-inner > a.brand "R$ Calculadora trabalhista SALÁRIO LÍQUI": The two lines belong to a single brand link: product name and subtitle. These are not wrapped navigation items, and the final screenshot shows both within the header.

A camada motion foi mantida sem editar o kit. Os momentos sorteados não foram aplicados a números financeiros ou meteorológicos. As três rodadas e os resultados exatos permanecem no registro; nenhuma contagem de gate foi usada como comparação com o baseline.

## Verificação específica do checkbox

O FAIL focus-visible de input#vt permaneceu no resultado automático. Verificação posterior por Tab real confirmou o foco na viewport e um anel no wrapper .check: sólido, 2px, rgb(13,116,128), sobre rgb(236,240,242), contraste calculado 4,785:1. Space alterou o estado do checkbox. O teste e2e/focus.spec.js passou (1 teste) e a [captura de foco](../docs/checkbox-focus.png) foi inspecionada. O checker mede apenas o input nativo e ignora o indicador do wrapper; classificamos este achado como falso positivo documentado, sem editar o resultado OPEN60 ou criar uma quarta rodada.
