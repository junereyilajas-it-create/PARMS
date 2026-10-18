import { useState } from 'react';
import { GISBoundaryDrawingModule } from './GISBoundaryDrawingModule';
import api from '../../lib/api';
import type { GISFeature } from '../../types/gis';

interface GISDrawModalProps {
  feature: GISFeature;
  onClose: () => void;
  onSaved: () => void;
}

export function GISDrawModal({ feature, onClose, onSaved }: GISDrawModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isBuilding = feature.type === 'building';

  const handleSaveConfirmed = async (geom: any, areaSqm: number, perimeterM: number) => {
    setIsSaving(true);
    setError('');

    try {
      const endpoint = isBuilding
        ? `/gis/buildings/${feature.id}`
        : `/gis/lots/${feature.id}`;

      await api.post(endpoint, {
        property_id: feature.property_id,
        coordinates: geom,
        area_sqm: areaSqm,
        perimeter_m: perimeterM,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save GIS boundary. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const BARANGAY_CENTERS: Record<string, [number, number]> = {
    poblacion: [8.8062, 124.7900],
    kauswagan: [8.8150, 124.7850],
    gaston: [8.8250, 124.7820],
    tabok: [8.8020, 124.7950],
    mabini: [8.7950, 124.8050],
    dampil: [8.8350, 124.7800],
    lumbo: [8.8100, 124.8100],
  };
  const brgyKey = (feature.barangay_name || '').toLowerCase().trim();
  const centerOverride = BARANGAY_CENTERS[brgyKey] || [8.8062, 124.7900];

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-6xl shadow-2xl">
        {isSaving && (
          <div className="mb-2 p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center animate-pulse">
            Saving boundary to database...
          </div>
        )}
        {error && (
          <div className="mb-2 p-3 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold border border-red-300">
            {error}
          </div>
        )}
        <GISBoundaryDrawingModule
          propertyType={isBuilding ? 'BUILDING' : 'LOT'}
          targetTitle={feature.title}
          lotAreaEntered={feature.area}
          initialCoordinates={feature.coordinates}
          centerOverride={centerOverride}
          onConfirmBoundary={(geom, area, perim) => {
            handleSaveConfirmed(geom, area, perim);
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
