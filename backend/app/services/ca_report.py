"""CA/RIA white-label client report — branded, print-ready HTML (no PDF dep).

The CA opens this in a tab and prints/saves to PDF; a server-side renderer
(WeasyPrint) can later convert the same HTML to a real PDF with zero template
changes. The firm's name leads; StockVision is a subtle "powered by" footer.
PANs are masked — full PANs never appear in a shareable report.
"""

from datetime import datetime, timezone
from typing import Any


def mask_pan(pan: str | None) -> str:
    p = (pan or "").strip().upper()
    if len(p) <= 6:
        return "XXXX"
    return p[:3] + "X" * (len(p) - 6) + p[-3:]


def _inr(value: float) -> str:
    return f"₹{round(value):,}"


def build_ca_report(firm_name: str, client: dict[str, Any]) -> dict[str, Any]:
    """Assemble report data from a serialized CA client (CAClientOut fields)."""
    gains = float(client.get("total_gains", 0) or 0)
    tax = float(client.get("total_tax", 0) or 0)
    return {
        "firm_name": (firm_name or "Advisory Firm").strip(),
        "generated_at": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "client": {
            "name": client.get("name", "—"),
            "pan_masked": mask_pan(client.get("pan")),
            "tax_year": client.get("tax_year", "—"),
            "filing_status": client.get("filing_status", "—"),
        },
        "tax": {
            "total_gains": gains,
            "total_tax": tax,
            "effective_rate": round(tax / gains * 100, 1) if gains else 0.0,
        },
    }


def render_ca_report_html(report: dict[str, Any]) -> str:
    """Render the report as a self-contained, print-ready HTML document."""
    firm = report["firm_name"]
    c = report["client"]
    t = report["tax"]
    status_color = {
        "FILED": "#16a34a", "IN_PROGRESS": "#d97706", "PENDING": "#6b7280", "OVERDUE": "#dc2626",
    }.get(c["filing_status"], "#6b7280")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{firm} — Tax &amp; Investment Report · {c['name']}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; background: #f3f4f6; }}
  .page {{ max-width: 820px; margin: 24px auto; background: #fff; padding: 48px 56px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }}
  .firm {{ font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }}
  .doc-title {{ color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }}
  .head {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 18px; }}
  .meta {{ text-align: right; font-size: 12px; color: #6b7280; }}
  h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 32px 0 12px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; }}
  .row {{ display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }}
  .row .k {{ color: #6b7280; }}
  .row .v {{ font-weight: 600; }}
  .stat {{ display: inline-block; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-right: 14px; }}
  .stat .label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }}
  .stat .num {{ font-size: 24px; font-weight: 800; margin-top: 4px; }}
  .pill {{ display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; color: #fff; background: {status_color}; }}
  .disclaimer {{ margin-top: 36px; font-size: 11px; color: #9ca3af; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 16px; }}
  .powered {{ margin-top: 10px; font-size: 11px; color: #9ca3af; }}
  @media print {{ body {{ background: #fff; }} .page {{ box-shadow: none; margin: 0; max-width: none; }} }}
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <div class="firm">{firm}</div>
        <div class="doc-title">Tax &amp; Investment Report</div>
      </div>
      <div class="meta">
        Generated {report['generated_at']}<br />FY {c['tax_year']}
      </div>
    </div>

    <h2>Client</h2>
    <div class="grid">
      <div class="row"><span class="k">Name</span><span class="v">{c['name']}</span></div>
      <div class="row"><span class="k">PAN</span><span class="v">{c['pan_masked']}</span></div>
      <div class="row"><span class="k">Tax year</span><span class="v">{c['tax_year']}</span></div>
      <div class="row"><span class="k">Filing status</span><span class="v"><span class="pill">{c['filing_status']}</span></span></div>
    </div>

    <h2>Capital gains summary</h2>
    <div>
      <span class="stat"><div class="label">Total gains</div><div class="num">{_inr(t['total_gains'])}</div></span>
      <span class="stat"><div class="label">Estimated tax</div><div class="num">{_inr(t['total_tax'])}</div></span>
      <span class="stat"><div class="label">Effective rate</div><div class="num">{t['effective_rate']}%</div></span>
    </div>

    <div class="disclaimer">
      This report is prepared by {firm} for the named client using StockVision analytics. Figures are
      for informational purposes and do not constitute investment or tax advice. Verify all amounts
      against broker statements and filed returns before submission.
    </div>
    <div class="powered">Powered by StockVision · stockvision.in</div>
  </div>
</body>
</html>"""
