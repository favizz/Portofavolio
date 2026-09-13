package com.wms.asset;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService service;

    public AssetController(AssetService service) {
        this.service = service;
    }

    @GetMapping
    public List<Asset> list() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public Asset get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ASSET_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public Asset create(@Valid @RequestBody Asset asset) {
        return service.create(asset);
    }

    /**
     * Records a division-to-division handover. Requires the ASSET_ADMIN
     * role - matches the RBAC-via-JWT security model described in the
     * internship report (frontend never touches the DB directly, every
     * write goes through a role-checked endpoint like this one).
     */
    @PostMapping("/{id}/relocate")
    @PreAuthorize("hasRole('ASSET_ADMIN')")
    public Asset relocate(
            @PathVariable Long id,
            @RequestParam String toDivision,
            @RequestParam String movedBy
    ) {
        return service.relocate(id, toDivision, movedBy);
    }

    @GetMapping("/{id}/history")
    public List<AssetMovement> history(@PathVariable Long id) {
        return service.history(id);
    }
}
