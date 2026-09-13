package com.wms.asset;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * IT asset management API - a compact re-implementation of the architecture
 * described in the PT Toyota Astra Motor "WMS" internship report: an asset
 * inventory service tracking movement/handover events and exposing an
 * audit trail, backed by SQL Server in production (H2 here for the
 * showcase build) and secured with JWT/RBAC.
 *
 * This module is presented as source/architecture only - see the
 * portfolio's Java showcase page for why there's no live deployment.
 */
@SpringBootApplication
public class WmsAssetApplication {
    public static void main(String[] args) {
        SpringApplication.run(WmsAssetApplication.class, args);
    }
}
