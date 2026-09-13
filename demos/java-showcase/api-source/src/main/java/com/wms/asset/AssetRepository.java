package com.wms.asset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetRepository extends JpaRepository<Asset, Long> {
    List<Asset> findByCurrentDivision(String division);
    List<Asset> findByStatus(String status);
}
