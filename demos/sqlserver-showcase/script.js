import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/+esm';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

const erSource = `
erDiagram
    Divisions ||--o{ Users : "based in"
    Divisions ||--o{ Assets : "currently holds"
    Divisions ||--o{ AssetMovements : "from / to"
    Users ||--o{ UserRoles : has
    Roles ||--o{ UserRoles : grants
    Users ||--o{ AssetMovements : performs
    Users ||--o{ Assets : "custodian of"
    AssetCategories ||--o{ Assets : categorizes
    Assets ||--o{ AssetMovements : "movement history"
    AuditLog }o--|| Assets : "logs changes to (by EntityId)"

    Divisions {
        int DivisionId PK
        nvarchar DivisionName
        nvarchar CostCenterCode
    }
    Users {
        int UserId PK
        nvarchar Username
        int DivisionId FK
    }
    Roles {
        int RoleId PK
        nvarchar RoleName
    }
    AssetCategories {
        int CategoryId PK
        nvarchar CategoryName
    }
    Assets {
        bigint AssetId PK
        nvarchar AssetTag
        int CategoryId FK
        int CurrentDivisionId FK
        int CustodianUserId FK
        nvarchar Status
    }
    AssetMovements {
        bigint MovementId PK
        bigint AssetId FK
        int FromDivisionId FK
        int ToDivisionId FK
        int MovedByUserId FK
        datetime2 MovedAt
    }
    AuditLog {
        bigint AuditId PK
        nvarchar EntityName
        bigint EntityId
        nvarchar Action
    }
`.trim();

async function renderErd() {
  const { svg } = await mermaid.render('erd-svg', erSource);
  document.getElementById('erd').innerHTML = svg;
}

async function loadSchema() {
  const res = await fetch('schema.sql');
  const text = await res.text();

  // Split into per-table CREATE TABLE blocks.
  const tableRegex = /CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g;
  const tables = [];
  let m;
  while ((m = tableRegex.exec(text)) !== null) {
    tables.push({ name: m[1], ddl: m[0] });
  }

  const tabsEl = document.getElementById('tableTabs');
  const ddlView = document.getElementById('ddlView');

  function show(table, tabEl) {
    document.querySelectorAll('#tableTabs .tab').forEach((t) => t.classList.remove('active'));
    tabEl.classList.add('active');
    ddlView.textContent = table.ddl;
    ddlView.className = 'language-sql';
    hljs.highlightElement(ddlView);
  }

  tables.forEach((table, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.textContent = table.name;
    tab.addEventListener('click', () => show(table, tab));
    tabsEl.appendChild(tab);
    if (i === 0) show(table, tab);
  });

  // Sample queries: everything after the "Sample read queries" marker.
  const idx = text.indexOf('Sample read queries');
  const queriesBlock = idx >= 0 ? text.slice(idx) : '';
  const queriesView = document.getElementById('queriesView');
  queriesView.textContent = queriesBlock.trim();
  hljs.highlightElement(queriesView);
}

renderErd();
loadSchema();
