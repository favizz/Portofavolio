package com.wms.asset;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AssetService {

    private final AssetRepository assets;
    private final AssetMovementRepository movements;

    public AssetService(AssetRepository assets, AssetMovementRepository movements) {
        this.assets = assets;
        this.movements = movements;
    }

    public List<Asset> findAll() {
        return assets.findAll();
    }

    public Asset findById(Long id) {
        return assets.findById(id)
                .orElseThrow(() -> new AssetNotFoundException(id));
    }

    public Asset create(Asset asset) {
        return assets.save(asset);
    }

    /**
     * Relocates an asset to a new division and writes an immutable
     * AssetMovement row - the append-only audit trail requirement from the
     * internship report, rather than just overwriting currentDivision.
     */
    public Asset relocate(Long assetId, String toDivision, String movedBy) {
        Asset asset = findById(assetId);
        String from = asset.getCurrentDivision();

        movements.save(new AssetMovement(assetId, from, toDivision, movedBy));

        asset.setCurrentDivision(toDivision);
        asset.setLastAuditedAt(Instant.now());
        return assets.save(asset);
    }

    public List<AssetMovement> history(Long assetId) {
        return movements.findByAssetIdOrderByMovedAtDesc(assetId);
    }
}
