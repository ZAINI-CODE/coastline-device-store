import { db, unwrap } from "./api.js";
import { resources, parseRecord } from "./admin-records.js";
import { safe, notify } from "./app.js";
import { recordsFromJSON } from "./admin-records.js";
import { recordsFromJSON as recordsFromJSON2 } from "./admin-records.js";
function bulkImportPanel(resource) {
  if(resource==='inventory')return '<p class="quote-note">Use the inventory editor for a counted adjustment with a reason, or the transactional catalogue importer for new inventory.</p>';
  return resource === "store_settings" ? "" : `<details class="panel"><summary>Import complete records from JSON</summary><p>Up to 200 records per batch. Existing records require their IDs. Import writes all form fields, so include complete records. The whole batch is saved in one database transaction.</p><form id="bulk-import" data-resource="${resource}"><label>JSON file<input type="file" id="bulk-file" accept="application/json,.json"></label><label>Or paste a JSON array<textarea name="records" rows="8" required></textarea></label><button class="button">Validate & import</button></form></details>`;
}
function wireBulkImport(render) {
  const form = document.querySelector("#bulk-import");
  if (!form) return;
  document.querySelector("#bulk-file").onchange = () => safe(async () => {
    const file = document.querySelector("#bulk-file").files[0];
    if (!file) return;
    if (file.size > 2e6) throw new Error("Use a JSON file smaller than 2 MB.");
    form.elements.records.value = await file.text();
  });
  form.onsubmit = (event) => safe(async () => {
    event.preventDefault();
    const records = recordsFromJSON2(form.dataset.resource, JSON.parse(form.elements.records.value));
    if (!confirm(`Import ${records.length} complete ${resources[form.dataset.resource].label.toLowerCase()} records? This can change prices, inventory and publication settings.`)) return;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await unwrap(db.from(form.dataset.resource).upsert(records, { onConflict: resources[form.dataset.resource].key.join(",") }));
      notify(records.length + " records imported.");
      await render();
    } finally {
      button.disabled = false;
    }
  });
}
export {
  bulkImportPanel,
  recordsFromJSON,
  wireBulkImport
};
