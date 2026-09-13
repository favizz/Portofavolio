package com.wms.asset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetMovementRepository extends JpaRepository<AssetMovement, Long> {
    List<AssetMovement> findByAssetIdOrderByMovedAtDesc(Long assetId);
}
