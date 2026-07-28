/**
 * Suite de humo del portafolio — plantilla adaptable.
 *
 * Comprueba mecánicamente los defectos que se repiten proyecto a proyecto y
 * que una captura estática no revela. Se escribe una vez, corre en CI para
 * siempre, y no depende de que nadie recuerde revisarlo.
 *
 * Para adaptarla: ajusta BASE_URL, ROUTES y los selectores de LOGIN si la app
 * requiere sesión. Todo lo demás funciona igual en cualquier stack.
 */
import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

/** Rutas públicas y privadas que la app expone. Enumerarlas TODAS. */
const ROUTES = ['/'];

/** Si la app necesita sesión, rellena esto; si no, deja login en null. */
const LOGIN: { path: string; fields: Record<string, string>; submit: string } | null = null;

const VIEWPORTS = {
  movil: { width: 390, height: 844 },
  escritorio: { width: 1280, height: 800 },
};

async function irA(page: Page, ruta: string) {
  const errores: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(`${BASE_URL}${ruta}`, { waitUntil: 'networkidle' });
  return errores;
}

async function iniciarSesion(page: Page) {
  if (!LOGIN) return;
  await page.goto(`${BASE_URL}${LOGIN.path}`, { waitUntil: 'networkidle' });
  for (const [selector, valor] of Object.entries(LOGIN.fields)) {
    await page.fill(selector, valor);
  }
  await page.click(LOGIN.submit);
  await page.waitForLoadState('networkidle');
}

for (const [nombre, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${nombre} (${viewport.width}px)`, () => {
    test.use({ viewport });

    for (const ruta of ROUTES) {
      test(`${ruta} — sin errores de consola ni contenido vacío`, async ({ page }) => {
        const errores = await irA(page, ruta);
        await iniciarSesion(page).catch(() => {});
        expect(errores, `errores de consola en ${ruta}`).toEqual([]);
        // Una página sin encabezado suele ser una pantalla en blanco o un fallo de render.
        await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
      });

      test(`${ruta} — la página no se desplaza en horizontal`, async ({ page }) => {
        await irA(page, ruta);
        const desborde = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          ancho: window.innerWidth,
          culpables: [...document.querySelectorAll('*')]
            .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 5)
            .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().slice(0, 40)}`),
        }));
        expect(
          desborde.scroll,
          `la página desborda a la derecha en ${ruta}: ${desborde.culpables.join(', ')}`,
        ).toBeLessThanOrEqual(desborde.ancho + 1);
      });

      test(`${ruta} — los campos muestran lo que se escribe`, async ({ page }) => {
        await irA(page, ruta);
        const campos = page.locator(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):visible, textarea:visible',
        );
        for (let i = 0; i < (await campos.count()); i++) {
          const campo = campos.nth(i);
          await campo.fill('prueba visible 12345');
          await expect(campo).toHaveValue('prueba visible 12345');
          // El texto escrito debe caber en el campo, no quedar recortado tras su borde.
          const caja = await campo.boundingBox();
          expect(caja, 'el campo debe ser visible al escribir').not.toBeNull();
          // Un campo que se encoge al recibir el foco deja al usuario escribiendo a ciegas.
          expect(caja!.width, 'campo demasiado estrecho para leer lo escrito').toBeGreaterThan(120);
          expect(caja!.x + caja!.width).toBeLessThanOrEqual(viewport.width + 1);
        }
      });

      test(`${ruta} — los menús y desplegables caben en pantalla`, async ({ page }) => {
        await irA(page, ruta);
        // Solo disparadores declarados: evita clics ciegos que navegan o abren
        // formularios y dejan la página en un estado imprevisible.
        const total = Math.min(await page.locator('[aria-haspopup]:visible').count(), 6);
        const problemas: string[] = [];
        for (let i = 0; i < total; i++) {
          // Recargar entre disparadores mantiene cada comprobación independiente.
          if (i > 0) await irA(page, ruta);
          const disparador = page.locator('[aria-haspopup]:visible').nth(i);
          const etiqueta =
            (await disparador.getAttribute('aria-label')) ?? `disparador ${i + 1}`;
          await disparador.click({ timeout: 5000 }).catch(() => {});
          const panel = page.locator('[role="menu"], [role="dialog"], [role="listbox"]').first();
          if (!(await panel.isVisible({ timeout: 2000 }).catch(() => false))) continue;
          const caja = await panel.boundingBox();
          if (caja) {
            if (caja.x < -1) problemas.push(`«${etiqueta}» se sale por la izquierda`);
            if (caja.x + caja.width > viewport.width + 1)
              problemas.push(`«${etiqueta}» se sale por la derecha`);
            if (caja.y + caja.height > viewport.height + 1)
              problemas.push(`«${etiqueta}» se corta por abajo`);
          }
          // Un menú puede caber en el viewport y aun así ser inservible si un
          // ancestro con overflow lo recorta: cada opción debe ser alcanzable.
          const opciones = panel.locator('[role="menuitem"], button, a');
          for (let j = 0; j < (await opciones.count()); j++) {
            const opcion = opciones.nth(j);
            const texto = ((await opcion.innerText().catch(() => '')) || `opción ${j + 1}`)
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 30);
            const alcanzable = await opcion
              .evaluate((el) => {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return false;
                const x = r.x + r.width / 2;
                const y = r.y + r.height / 2;
                if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
                const encima = document.elementFromPoint(x, y);
                return el === encima || el.contains(encima) || encima?.contains(el) || false;
              })
              .catch(() => false);
            if (!alcanzable)
              problemas.push(`«${etiqueta}»: la opción «${texto}» queda tapada o recortada`);
          }
          await page.keyboard.press('Escape').catch(() => {});
        }
        expect(problemas, problemas.join('; ')).toEqual([]);
      });
    }
  });
}

for (const [nombre, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${nombre} — contenido largo`, () => {
    test.use({ viewport });

    test('una palabra muy larga no rompe ningún contenedor', async ({ page }) => {
      await irA(page, ROUTES[0]!);
      // Texto sin espacios: el caso que revienta cajas mal configuradas.
      const palabrota = 'Interminable'.repeat(12);
      const campo = page.locator('textarea:visible, input[type=text]:visible').first();
      if (await campo.count()) {
        await campo.fill(palabrota);
        await page.waitForTimeout(300);
      }
      const desbordes = await page.evaluate(() =>
        [...document.querySelectorAll('div, section, article, dialog, p')]
          .filter((e) => {
            const est = getComputedStyle(e);
            if (est.overflowX === 'auto' || est.overflowX === 'scroll') return false;
            return e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0;
          })
          .slice(0, 5)
          .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().slice(0, 30)}`),
      );
      expect(desbordes, `contenedores desbordados: ${desbordes.join(', ')}`).toEqual([]);
    });
  });
}

test.describe('formularios', () => {
  test('un error de validación no borra lo que el usuario escribió', async ({ page }) => {
    // Adaptar: ruta del formulario, campos a rellenar y el error que se provoca.
    test.skip(ROUTES.length === 1, 'configurar con el formulario real del proyecto');
  });
});
