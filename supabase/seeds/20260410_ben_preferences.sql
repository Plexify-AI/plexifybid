-- Seed: Ben D'Amprisi Jr. (SunnAx Technologies) preferences
-- Keyed to slug = 'ben-damprisi-sunnax' — only affects Ben's tenant.
-- Run this AFTER the 20260410_tenant_preferences.sql migration.
--
-- IMPORTANT: Verify the tenant exists first:
--   SELECT id, slug, name FROM tenants WHERE slug = 'ben-damprisi-sunnax';

-- Email signature (HTML — table-based for email client compatibility)
-- Price list (Xencelabs product catalog with MSRP + MAP)
-- Default closing + pricing instructions

UPDATE tenants
SET preferences = '{
  "email_signature": "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1a1a1a;\"><tr><td style=\"padding-right: 16px; vertical-align: middle;\"><img src=\"https://sunnax.net/wp-content/uploads/2020/12/SunnAx-Logo-Final.png\" alt=\"SunnAx Technologies\" width=\"90\" style=\"display: block;\" /></td><td style=\"border-left: 2px solid #cc0000; padding-left: 16px; vertical-align: middle;\"><div style=\"font-size: 16px; font-weight: bold; color: #1a1a1a;\">SunnAx Technologies</div><div style=\"font-size: 15px; font-weight: bold; color: #cc0000; margin-top: 2px;\">Ben D\u2019Amprisi Jr.</div><div style=\"font-size: 13px; color: #333333; margin-top: 4px;\">917.553.1488</div><div style=\"font-size: 13px; margin-top: 2px;\"><a href=\"mailto:Ben@SunnAx.net\" style=\"color: #1a1a1a; text-decoration: none;\">Ben@SunnAx.net</a></div></td></tr></table>",
  "default_closing": "Cheers,",
  "include_closing": true,
  "default_price_column": "map",
  "price_note": "Use MAP pricing in all outreach unless user explicitly requests MSRP. Never estimate or round prices \u2014 use exact values from this list.",
  "price_list": [
    { "product": "Xencelabs Pen Tablet Small", "sku": "XMCTSSFRES", "msrp": "$139.99", "map": "$104.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium", "sku": "XMCTSMFRESN", "msrp": "$249.99", "map": "$199.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium v2", "sku": "XEPTMGV2", "msrp": "$249.99", "map": "$219.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium Bundle", "sku": "XMCTBMFRESN", "msrp": "$329.99", "map": "$230.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium Bundle v2", "sku": "XEPTMBGV2", "msrp": "$329.99", "map": "$249.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium Bundle SEv2 (Special Edition)", "sku": "XEPTMBSEGV2", "msrp": "$349.99", "map": "$249.99", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Tablet Medium EDU Pack", "sku": "XMCTSMED", "msrp": "$2,250.00", "map": "$1,649.00", "category": "Pen Tablets" },
    { "product": "Xencelabs Pen Display 16 Lite", "sku": "XEPD16LGB", "msrp": "$799.00", "map": "$749.00", "category": "Pen Displays" },
    { "product": "Xencelabs Pen Display 16 EDU Essentials (includes Mobile Easel)", "sku": "XEPDS16EFSEDU", "msrp": "$799.00", "map": "$749.00", "category": "Pen Displays" },
    { "product": "Xencelabs Pen Display 16 Bundle", "sku": "XEPDB16EFS", "msrp": "$1,249.00", "map": "$1,099.00", "category": "Pen Displays" },
    { "product": "Xencelabs Pen Display 24", "sku": "XMPD24US", "msrp": "$1,799.00", "map": "$1,724.00", "category": "Pen Displays" },
    { "product": "Xencelabs Pen Display 24+", "sku": "XMPD24HPUS", "msrp": "$1,899.00", "map": "$1,749.00", "category": "Pen Displays" },
    { "product": "Xencelabs Quick Keys (Remote Controller w/Dongle and Case)", "sku": "XMCQKFRES", "msrp": "$99.99", "map": "$79.99", "category": "Quick Keys" },
    { "product": "Xencelabs 3 Button Pen v2 +Eraser", "sku": "XEPTMBSEGV2", "msrp": "$49.99", "map": "$43.00", "category": "Accessories" },
    { "product": "Xencelabs Thin Pen v2 +Eraser", "sku": "XEPTMBSEGV2", "msrp": "$46.99", "map": "$39.50", "category": "Accessories" },
    { "product": "Xencelabs Hub Bundle (for Pen Display 16)", "sku": "XEHUBE", "msrp": "$149.99", "map": "$149.99", "category": "Accessories" },
    { "product": "Xencelabs Carrying Case (for Pen Display 16)", "sku": "XTC01", "msrp": "$49.99", "map": "$39.99", "category": "Accessories" },
    { "product": "Xencelabs Mobile Easel (for Pen Display 16)", "sku": "XEMES", "msrp": "$49.99", "map": "$49.99", "category": "Accessories" },
    { "product": "Xencelabs Desktop Easel (for Pen Display 16)", "sku": "XEDE", "msrp": "$179.99", "map": "$159.99", "category": "Accessories" },
    { "product": "Xencelabs Multi-Axis Stand (for Pen Display 24)", "sku": "XEMAS", "msrp": "$299.99", "map": "$269.99", "category": "Accessories" }
  ]
}'::jsonb
WHERE slug = 'ben-damprisi-sunnax';
