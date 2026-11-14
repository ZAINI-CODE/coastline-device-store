import {H1,H2,Text,Stack,Row,Divider,useHostTheme} from 'cursor/canvas';

const sections = [
  ['Frontend','NEEDS FIX','13 live products and all product pages inspected; three products have incomplete purchase data.'],
  ['Backend','NEEDS FIX','57 automated checks pass; hosted order-email outbox and worker are absent.'],
  ['Supabase','CONFIGURATION REQUIRED','28 application tables have RLS; production origin and authentication defaults still need configuration.'],
  ['Checkout','NOT VERIFIED','Guest login gate passes. No hosted order or bank-confirmed customer-to-admin Zelle test was performed.'],
  ['Security','NOT VERIFIED','Anonymous private reads denied; full two-customer and admin MFA transaction acceptance remains outstanding.'],
  ['Hosting','CONFIGURATION REQUIRED','Recommend Netlify static CDN plus existing Supabase; no PHP or persistent Node runtime needed.'],
  ['Domain / HTTPS','CONFIGURATION REQUIRED','Apex and www DNS returned ENOTFOUND from the audited resolver; TLS could not be tested.'],
  ['Performance / SEO','NEEDS FIX','Production build succeeds; robots/noindex block indexing and zero static product pages are generated.'],
  ['PayPal / cards','FUTURE ENHANCEMENT','Keep disabled. Their future integration does not block a safely tested Zelle-only launch.'],
];
const gates = [
  ['1. Preserve recovery','Export schema/data, back up Storage separately and prove isolated restore before approved changes.'],
  ['2. Reconcile data and migration state','Resolve AirPods 5, AirPods Max 2 and PS5 Pro incomplete public purchase data; do not invent stock/prices.'],
  ['3. Configure production services','Canonical origin, Auth URL/redirects, SMTP, order-email worker, hosting, DNS and HTTPS require approval.'],
  ['4. Close payment risks','Reconcile aged Zelle holds; fix concurrent screenshot retry orphan cleanup without weakening ownership or MFA.'],
  ['5. Complete acceptance','Fresh Google/email callbacks, two-user isolation, bank-confirmed Zelle, fulfillment emails and real responsive devices.'],
  ['6. Approve and release','Publish only after approval; preserve immutable release and separate frontend/database rollback plans.'],
];
export default function ReadinessOverview(){
  const t=useHostTheme();
  return <Stack gap={20} style={{padding:24,color:t.text.primary,background:t.bg.editor}}>
    <Text>COASTLINE DEVICE · 12 NOVEMBER 2026</Text>
    <H1>Hold production ordering</H1>
    <Text>The architecture is compatible, but configuration and live acceptance gaps prevent a production-ready claim. Audit only: no hosted changes, deployment, payments, reviews or inventory updates.</Text>
    <Row gap={28} wrap><div><H2>57 / 57</H2><Text>Fresh automated checks passed</Text></div><div><H2>13</H2><Text>Live product pages inspected</Text></div><div><H2>28</H2><Text>Application tables with RLS</Text></div></Row>
    <Divider/>
    <H2>Readiness by area</H2>
    {sections.map(([name,status,detail])=><details key={name} style={{padding:'10px 0',borderBottom:`1px solid ${t.stroke.secondary}`}}><summary style={{cursor:'pointer'}}>{name} — <span style={{color:t.text.secondary}}>{status}</span></summary><p style={{color:t.text.secondary,lineHeight:1.6}}>{detail}</p></details>)}
    <H2>Release gates in execution order</H2>
    {gates.map(([name,detail])=><div key={name}><strong>{name}</strong><p style={{color:t.text.secondary,lineHeight:1.6,margin:'6px 0'}}>{detail}</p></div>)}
    <Divider/>
    <Text>Source: fresh local tests/build, read-only public API probes, hosted schema/settings inspection and browser checks. Exact phone/tablet widths, real bank payment, email delivery and full hosted transaction isolation remain unverified. Detailed evidence and rollback procedure are in REPORT.md and DEPLOYMENT-CHECKLIST.md beside this artifact.</Text>
  </Stack>;
}
