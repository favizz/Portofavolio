-- IT Asset Management schema, T-SQL (SQL Server 2022), split into an
-- operational database and a separate logging database per the internship
-- report's architecture note. This file is the real, complete DDL behind
-- the ERD/table browser on this showcase page.

-- =========================================================
-- Operational database
-- =========================================================

CREATE TABLE Divisions (
    DivisionId      INT             IDENTITY(1,1) PRIMARY KEY,
    DivisionName    NVARCHAR(100)   NOT NULL UNIQUE,
    CostCenterCode  NVARCHAR(20)    NOT NULL
);

CREATE TABLE Users (
    UserId          INT             IDENTITY(1,1) PRIMARY KEY,
    Username        NVARCHAR(50)    NOT NULL UNIQUE,
    PasswordHash    NVARCHAR(256)   NOT NULL,
    DivisionId      INT             NOT NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Division FOREIGN KEY (DivisionId) REFERENCES Divisions(DivisionId)
);

CREATE TABLE Roles (
    RoleId          INT             IDENTITY(1,1) PRIMARY KEY,
    RoleName        NVARCHAR(50)    NOT NULL UNIQUE -- e.g. ASSET_ADMIN, VIEWER
);

CREATE TABLE UserRoles (
    UserId          INT             NOT NULL,
    RoleId          INT             NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES Users(UserId),
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
);

CREATE TABLE AssetCategories (
    CategoryId      INT             IDENTITY(1,1) PRIMARY KEY,
    CategoryName    NVARCHAR(50)    NOT NULL UNIQUE -- laptop, printer, scanner, server, ...
);

CREATE TABLE Assets (
    AssetId             BIGINT          IDENTITY(1,1) PRIMARY KEY,
    AssetTag            NVARCHAR(30)    NOT NULL UNIQUE,
    CategoryId          INT             NOT NULL,
    CurrentDivisionId   INT             NOT NULL,
    CustodianUserId     INT             NULL,
    Status              NVARCHAR(20)    NOT NULL DEFAULT 'IN_USE', -- IN_USE, IN_STORAGE, IN_REPAIR, DECOMMISSIONED
    PurchaseDate        DATE            NULL,
    LastAuditedAt        DATETIME2       NULL,
    CONSTRAINT FK_Assets_Category  FOREIGN KEY (CategoryId) REFERENCES AssetCategories(CategoryId),
    CONSTRAINT FK_Assets_Division  FOREIGN KEY (CurrentDivisionId) REFERENCES Divisions(DivisionId),
    CONSTRAINT FK_Assets_Custodian FOREIGN KEY (CustodianUserId) REFERENCES Users(UserId),
    CONSTRAINT CK_Assets_Status CHECK (Status IN ('IN_USE','IN_STORAGE','IN_REPAIR','DECOMMISSIONED'))
);

CREATE INDEX IX_Assets_CurrentDivision ON Assets(CurrentDivisionId);
CREATE INDEX IX_Assets_Status ON Assets(Status);

-- Append-only handover/movement history: never UPDATE a row here, only INSERT.
CREATE TABLE AssetMovements (
    MovementId          BIGINT          IDENTITY(1,1) PRIMARY KEY,
    AssetId             BIGINT          NOT NULL,
    FromDivisionId       INT             NOT NULL,
    ToDivisionId         INT             NOT NULL,
    MovedByUserId        INT             NOT NULL,
    MovedAt              DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    Notes                NVARCHAR(500)   NULL,
    CONSTRAINT FK_Movements_Asset FOREIGN KEY (AssetId) REFERENCES Assets(AssetId),
    CONSTRAINT FK_Movements_FromDivision FOREIGN KEY (FromDivisionId) REFERENCES Divisions(DivisionId),
    CONSTRAINT FK_Movements_ToDivision FOREIGN KEY (ToDivisionId) REFERENCES Divisions(DivisionId),
    CONSTRAINT FK_Movements_MovedBy FOREIGN KEY (MovedByUserId) REFERENCES Users(UserId)
);

CREATE INDEX IX_Movements_AssetId ON AssetMovements(AssetId, MovedAt DESC);

-- =========================================================
-- Logging database (separate DB per the internship architecture note)
-- =========================================================

CREATE TABLE AuditLog (
    AuditId         BIGINT          IDENTITY(1,1) PRIMARY KEY,
    EntityName      NVARCHAR(50)    NOT NULL, -- 'Asset', 'AssetMovement', 'User', ...
    EntityId        BIGINT          NOT NULL,
    Action          NVARCHAR(20)    NOT NULL, -- 'CREATE','UPDATE','DELETE','LOGIN'
    PerformedByUserId INT           NOT NULL,
    PerformedAt     DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    Detail          NVARCHAR(MAX)   NULL -- JSON diff/snapshot
);

CREATE INDEX IX_AuditLog_Entity ON AuditLog(EntityName, EntityId, PerformedAt DESC);

-- =========================================================
-- Sample read queries (illustrative - see the "Sample Queries" tab)
-- =========================================================

-- Every asset currently held by a division, with category name and current custodian.
-- SELECT a.AssetTag, c.CategoryName, d.DivisionName, u.Username AS Custodian, a.Status
-- FROM Assets a
-- JOIN AssetCategories c ON c.CategoryId = a.CategoryId
-- JOIN Divisions d ON d.DivisionId = a.CurrentDivisionId
-- LEFT JOIN Users u ON u.UserId = a.CustodianUserId
-- WHERE d.DivisionName = @DivisionName;

-- Full handover history for one asset, most recent first.
-- SELECT m.MovedAt, fd.DivisionName AS FromDivision, td.DivisionName AS ToDivision, u.Username AS MovedBy
-- FROM AssetMovements m
-- JOIN Divisions fd ON fd.DivisionId = m.FromDivisionId
-- JOIN Divisions td ON td.DivisionId = m.ToDivisionId
-- JOIN Users u ON u.UserId = m.MovedByUserId
-- WHERE m.AssetId = @AssetId
-- ORDER BY m.MovedAt DESC;

-- Assets that haven't been audited in over 6 months (compliance check).
-- SELECT AssetTag, LastAuditedAt
-- FROM Assets
-- WHERE LastAuditedAt IS NULL OR LastAuditedAt < DATEADD(MONTH, -6, SYSUTCDATETIME());
