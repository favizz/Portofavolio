package com.wms.asset;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.Instant;

/**
 * One row per handover/movement event - this is the audit trail the
 * internship report's "Audit Trails" requirement maps to: every asset
 * relocation between divisions is recorded, never overwritten in place.
 */
@Entity
public class AssetMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long assetId;
    private String fromDivision;
    private String toDivision;
    private String movedBy;
    private Instant movedAt;

    protected AssetMovement() {
    }

    public AssetMovement(Long assetId, String fromDivision, String toDivision, String movedBy) {
        this.assetId = assetId;
        this.fromDivision = fromDivision;
        this.toDivision = toDivision;
        this.movedBy = movedBy;
        this.movedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getAssetId() { return assetId; }
    public String getFromDivision() { return fromDivision; }
    public String getToDivision() { return toDivision; }
    public String getMovedBy() { return movedBy; }
    public Instant getMovedAt() { return movedAt; }
}
