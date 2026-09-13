package com.wms.asset;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

@Entity
public class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    private String assetTag;

    @NotBlank
    private String category; // laptop, printer, scanner, server, etc.

    @NotBlank
    private String currentDivision;

    private String custodianName;

    private String status; // IN_USE, IN_STORAGE, IN_REPAIR, DECOMMISSIONED

    private Instant lastAuditedAt;

    protected Asset() {
        // required by JPA
    }

    public Asset(String assetTag, String category, String currentDivision) {
        this.assetTag = assetTag;
        this.category = category;
        this.currentDivision = currentDivision;
        this.status = "IN_USE";
    }

    public Long getId() { return id; }
    public String getAssetTag() { return assetTag; }
    public String getCategory() { return category; }
    public String getCurrentDivision() { return currentDivision; }
    public void setCurrentDivision(String currentDivision) { this.currentDivision = currentDivision; }
    public String getCustodianName() { return custodianName; }
    public void setCustodianName(String custodianName) { this.custodianName = custodianName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getLastAuditedAt() { return lastAuditedAt; }
    public void setLastAuditedAt(Instant lastAuditedAt) { this.lastAuditedAt = lastAuditedAt; }
}
