import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  FileImage,
  ZoomIn,
  ZoomOut,
  Check,
  AlertTriangle,
  Save,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Layers
} from 'lucide-react';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { MapContainer, TileLayer, Polygon, Marker, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatPointPair, detectSelfIntersection } from '../lib/gisGeometry';
import { createCornerPointIcon, createSideLengthIcon } from '../lib/gisUtils';

const MapController = ({ bounds, zoom, setZoom, fitTrigger }: { bounds: any; zoom: number; setZoom: any; fitTrigger: number }) => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [20, 20] });
      setZoom(map.getZoom());
    }, 50);
    return () => clearTimeout(t);
  }, [bounds, map, fitTrigger]);

  useEffect(() => {
    if (Math.abs(map.getZoom() - zoom) > 0.05) map.setZoom(zoom);
  }, [zoom, map]);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, setZoom]);
  return null;
};

type Segment = {
  segment_id?: number;
  segment_number: number;
  from_point: string;
  to_point: string;
  bearing: string;
  distance: number | string;
  is_corrected: boolean;
};

type ScanRecord = {
  scan_id: number;
  original_filename: string;
  stored_filepath: string;
  status: string;
  lot_number: string;
  cad_reference: string;
  barangay: string;
  municipality: string;
  province: string;
  survey_date: string;
  stated_area: number;
  calculated_area: number;
  closure_error: number;
  gis_geometry: any;
  upload_date: string;
};

export function BlueprintScanner() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [isUploading, setIsUploading] = useState(false);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeScan, setActiveScan] = useState<ScanRecord | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [zoom, setZoom] = useState(-1);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [imageBounds, setImageBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ownerName, setOwnerName] = useState('Unknown Owner');

  // Manual Sides Configuration State
  const [manualSidesCount, setManualSidesCount] = useState<number>(4);
  const [isSendingToGis, setIsSendingToGis] = useState(false);
  const [targetPropertyId, setTargetPropertyId] = useState<string>('');

  useEffect(() => {
    if (activeScan?.stored_filepath) {
      setImageBounds(null);
      const img = new Image();
      img.onload = () => setImageBounds([[0, 0], [img.naturalHeight, img.naturalWidth]]);
      img.src = `http://localhost:5000${activeScan.stored_filepath}`;
    } else {
      setImageBounds(null);
    }
  }, [activeScan?.stored_filepath]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userRole = localStorage.getItem('accessor_role') || '';

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    try {
      await ensureSession();
      const { data } = await api.get('/scanner');
      setScans(data);
    } catch {
      showError('Failed to load scan history.');
    }
  };

  const loadActiveScan = async (id: number) => {
    try {
      const { data } = await api.get(`/scanner/${id}`);
      setActiveScan(data.blueprint);
      setOwnerName(data.blueprint.owner_name || '');
      setSegments(data.segments);
    } catch {
      showError('Failed to load scan details.');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadFile = e.target.files[0];

    const formData = new FormData();
    formData.append('blueprint', uploadFile);

    setIsUploading(true);
    try {
      await ensureSession();
      const { data } = await api.post('/scanner/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showSuccess(data.message);
      await loadScans();
      setTimeout(() => loadActiveScan(data.scan_id), 3000);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSegmentChange = (index: number, field: keyof Segment, value: string) => {
    const updated = [...segments];
    updated[index] = { ...updated[index], [field]: value, is_corrected: true };
    setSegments(updated);
  };

  // Add a new segment
  const handleAddSegment = () => {
    const nextIdx = segments.length + 1;
    const fromP = String(nextIdx);
    const toP = String(nextIdx + 1);
    setSegments([
      ...segments,
      {
        segment_number: nextIdx,
        from_point: fromP,
        to_point: toP,
        bearing: '',
        distance: 15.0,
        is_corrected: true
      }
    ]);
  };

  // Remove a segment
  const handleRemoveSegment = (index: number) => {
    const updated = segments.filter((_, i) => i !== index);
    setSegments(updated);
  };

  // Configure manual sides when OCR was unclear
  const handleConfigureSides = (count: number) => {
    setManualSidesCount(count);
    const newSegs: Segment[] = [];
    for (let i = 0; i < count; i++) {
      const fromP = String(i + 1);
      const toP = String(((i + 1) % count) + 1);
      newSegs.push({
        segment_number: i + 1,
        from_point: fromP,
        to_point: toP,
        bearing: '',
        distance: i === 0 || i === 2 ? 14.48 : 8.6,
        is_corrected: true
      });
    }
    setSegments(newSegs);
  };

  const saveSegments = async () => {
    if (!activeScan) return;
    setIsSaving(true);
    try {
      const { data } = await api.put(`/scanner/${activeScan.scan_id}/segments`, {
        segments,
        replaceAll: true
      });
      setActiveScan({
        ...activeScan,
        calculated_area: data.calculated_area,
        closure_error: data.closure_error,
        gis_geometry: data.gis_geometry
      });
      setSegments(data.segments);
      showSuccess('Geometry recalculated and saved successfully.');
    } catch {
      showError('Failed to save segments');
    } finally {
      setIsSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!activeScan) return;
    const confirmMessage =
      userRole === 'admin' || userRole === 'super_admin'
        ? 'Save this blueprint as an official property record?'
        : 'Submit this blueprint for Admin approval to create a new lot?';
    showConfirm(confirmMessage, async () => {
      try {
        await api.post(`/scanner/${activeScan.scan_id}/submit`, {
          owner: ownerName,
          lot_number: activeScan.lot_number,
          cad_reference: activeScan.cad_reference,
          barangay: activeScan.barangay,
          municipality: activeScan.municipality,
          province: activeScan.province,
          survey_date: activeScan.survey_date,
          stated_area: activeScan.stated_area
        });
        showSuccess('Submitted successfully.');
        loadActiveScan(activeScan.scan_id);
      } catch {
        showError('Submission failed.');
      }
    });
  };

  // Direct GIS Mapping Action
  const handleSendToGIS = async () => {
    if (!activeScan || !targetPropertyId) {
      showError('Please enter a target Property ID to map this lot boundary.');
      return;
    }
    setIsSendingToGis(true);
    try {
      const { data } = await api.post(`/scanner/${activeScan.scan_id}/to-gis`, {
        property_id: Number(targetPropertyId)
      });
      showSuccess(data.message || 'Lot boundary saved to GIS!');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to map boundary to GIS.');
    } finally {
      setIsSendingToGis(false);
    }
  };

  // Geometric validations on current segments
  const validationAnalysis = useMemo(() => {
    const warnings: string[] = [];
    const errors: string[] = [];

    const dists = segments.map(s => Number(s.distance) || 0);
    const n = dists.length;

    if (n === 4) {
      const s0 = dists[0];
      const s1 = dists[1];
      const s2 = dists[2];
      const s3 = dists[3];

      // Check opposite side equality for rectangles
      const diff1 = Math.abs(s0 - s2);
      const diff2 = Math.abs(s1 - s3);
      if (diff1 > 0.05 || diff2 > 0.05) {
        warnings.push('The entered side lengths do not form an exact rectangle (opposite sides are unequal).');
      }
    }

    const scanCoords = activeScan?.gis_geometry?.coordinates?.[0];
    if (scanCoords && scanCoords.length > 3) {
      if (detectSelfIntersection(scanCoords)) {
        errors.push('The polygon contains intersecting boundary lines.');
      }
    }

    if (activeScan?.stated_area && activeScan?.calculated_area) {
      const diffArea = Math.abs(Number(activeScan.stated_area) - Number(activeScan.calculated_area));
      if (diffArea > 2) {
        warnings.push(`Calculated area (${activeScan.calculated_area} m²) differs from the recorded property area (${activeScan.stated_area} m²).`);
      }
    }

    return { warnings, errors };
  }, [segments, activeScan]);

  // Derived Leaflet coordinates from Cartesian local geometry
  const polygonGeo = useMemo(() => {
    if (!activeScan?.gis_geometry?.coordinates) return null;
    const coords = activeScan.gis_geometry.coordinates[0];
    if (!coords || coords.length === 0) return null;

    const boundsCenter: [number, number] = [8.834, 124.786];
    const metersPerDegLat = 111139;
    const metersPerDegLng = 111139 * Math.cos((boundsCenter[0] * Math.PI) / 180);

    // Centroid of local coords
    const meanX = coords.reduce((acc: number, c: number[]) => acc + c[0], 0) / coords.length;
    const meanY = coords.reduce((acc: number, c: number[]) => acc + c[1], 0) / coords.length;

    const leafletPositions: [number, number][] = coords.map((c: number[]) => [
      boundsCenter[0] + (c[1] - meanY) / metersPerDegLat,
      boundsCenter[1] + (c[0] - meanX) / metersPerDegLng
    ]);

    // Unique vertices (without duplicate closing point)
    let vertices = [...leafletPositions];
    if (
      vertices.length > 2 &&
      vertices[0][0] === vertices[vertices.length - 1][0] &&
      vertices[0][1] === vertices[vertices.length - 1][1]
    ) {
      vertices = vertices.slice(0, vertices.length - 1);
    }

    // Midpoints for side badges
    const edges: { mid: [number, number]; label: string; dist: number }[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % vertices.length];
      const pair = formatPointPair(i, vertices.length);
      const dist = Number(segments[i]?.distance) || 0;
      edges.push({
        mid: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2],
        label: pair.label,
        dist
      });
    }

    return {
      positions: leafletPositions,
      vertices,
      edges
    };
  }, [activeScan?.gis_geometry, segments]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cadastral Blueprint Scanner</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Upload, OCR, and verify technical survey plans. Auto-generate GIS lot boundaries using numbered corner points.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,application/pdf"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition shadow-md font-bold cursor-pointer"
          >
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} Upload Plan
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* LEFT COLUMN: Document Viewer + Scan History */}
        <div className="lg:w-1/2 w-full flex flex-col gap-6">
          <div className="flex-1 min-h-[480px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <FileImage size={18} /> Document Preview
              </h3>
              {activeScan && (
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setZoom(z => z - 0.5)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <ZoomOut size={18} className="dark:text-white" />
                  </button>
                  <span className="text-sm dark:text-gray-300 self-center w-10 text-center">
                    {Math.round(Math.pow(2, zoom) * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(z => z + 0.5)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <ZoomIn size={18} className="dark:text-white" />
                  </button>
                  <button
                    onClick={() => setFitTrigger(f => f + 1)}
                    className="ml-2 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    Fit Screen
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative">
              {activeScan && imageBounds ? (
                <MapContainer
                  crs={L.CRS.Simple}
                  bounds={imageBounds}
                  zoomSnap={0.1}
                  zoomDelta={0.5}
                  wheelPxPerZoomLevel={60}
                  style={{ height: '100%', width: '100%', background: 'transparent' }}
                  attributionControl={false}
                >
                  <ImageOverlay url={`http://localhost:5000${activeScan.stored_filepath}`} bounds={imageBounds} />
                  <MapController bounds={imageBounds} zoom={zoom} setZoom={setZoom} fitTrigger={fitTrigger} />
                </MapContainer>
              ) : activeScan && !imageBounds ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p>Loading document preview...</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <FileImage size={48} className="mb-2 opacity-20" />
                  <p>Select a scan from history or upload a new plan</p>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM LEFT: Scan History */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 h-[280px] shrink-0 flex flex-col">
            <h3 className="font-bold text-base dark:text-white mb-3 shrink-0">Survey Plans History</h3>
            <div className="flex-1 overflow-y-auto pr-2 min-h-0 custom-scrollbar">
              <div className="grid grid-cols-1 gap-3">
                {scans.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 border border-dashed rounded-xl dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs">
                    No scan history available. Upload a blueprint to begin.
                  </div>
                ) : (
                  scans.map(s => (
                    <div
                      key={s.scan_id}
                      onClick={() => loadActiveScan(s.scan_id)}
                      className={`border rounded-xl p-3.5 cursor-pointer transition ${
                        activeScan?.scan_id === s.scan_id
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate pr-2">
                          {s.original_filename}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            s.status === 'processing'
                              ? 'bg-amber-100 text-amber-700'
                              : s.status === 'pending_approval'
                              ? 'bg-blue-100 text-blue-700'
                              : s.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Lot: <strong>{s.lot_number || 'N/A'}</strong></span>
                        <span>{s.municipality || 'Lagonglong'}, {s.barangay || 'Poblacion'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Technical Description Extraction & Reconstructed Polygon */}
        <div className="lg:w-1/2 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
          {activeScan ? (
            <div className="flex flex-col h-full">
              {/* Properties Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80">
                <h3 className="font-bold text-base dark:text-white mb-2.5">Survey & Lot Details</h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Owner Name</label>
                    <input
                      className="w-full border rounded-lg px-2.5 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Lot Number</label>
                    <input
                      className="w-full border rounded-lg px-2.5 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      value={activeScan.lot_number || ''}
                      onChange={e => setActiveScan({ ...activeScan, lot_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Barangay</label>
                    <input
                      className="w-full border rounded-lg px-2.5 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      value={activeScan.barangay || ''}
                      onChange={e => setActiveScan({ ...activeScan, barangay: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-0.5">Stated Area (m²)</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg px-2.5 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono font-bold"
                      value={activeScan.stated_area || ''}
                      onChange={e => setActiveScan({ ...activeScan, stated_area: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Area Comparison & Closure Error Summary */}
                <div className="grid grid-cols-2 gap-3 text-xs mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Calculated Area</span>
                    <strong
                      className={`text-base font-mono ${
                        Math.abs((activeScan.stated_area || 0) - (activeScan.calculated_area || 0)) > 2
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {activeScan.calculated_area || 0} m²
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Traverse Closure</span>
                    <strong
                      className={`text-base font-mono ${
                        (activeScan.closure_error || 0) > 0.5 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {activeScan.closure_error !== undefined ? `${activeScan.closure_error}m` : '0.00m'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Validation Warnings */}
              {validationAnalysis.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>Technical Description Notice:</span>
                  </div>
                  {validationAnalysis.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
                      • {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Missing or Unreadable Blueprint Helper */}
              <div className="px-4 py-2.5 bg-blue-50/70 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
                <span className="text-xs text-blue-900 dark:text-blue-300 font-semibold">
                  Missing or unclear description?
                </span>
                <div className="flex items-center gap-1">
                  {[3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleConfigureSides(num)}
                      className={`px-2 py-0.5 border text-[10px] font-bold rounded cursor-pointer transition ${
                        manualSidesCount === num
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 hover:bg-blue-100 text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {num} Sides
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Table with Numbered Consecutive Points */}
              <div className="flex-1 p-4 overflow-y-auto max-h-60 custom-scrollbar">
                <table className="w-full text-xs text-left dark:text-gray-300">
                  <thead className="text-[10px] uppercase bg-gray-50 dark:bg-gray-700/80 dark:text-gray-300">
                    <tr>
                      <th className="px-2.5 py-2">Line (Points)</th>
                      <th className="px-2.5 py-2">Bearing (Optional)</th>
                      <th className="px-2.5 py-2">Distance (m)</th>
                      <th className="px-2 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2.5 py-4 text-center text-gray-500">
                          No segments extracted. Click "4 Sides" above to enter manually.
                        </td>
                      </tr>
                    ) : (
                      segments.map((seg, idx) => (
                        <tr
                          key={idx}
                          className="border-b dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-2.5 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Point {seg.from_point} → Point {seg.to_point} ({seg.from_point}–{seg.to_point})
                            </span>
                          </td>
                          <td className="px-2.5 py-2">
                            <input
                              className="w-28 bg-transparent border-b border-dashed dark:text-white outline-none font-mono"
                              value={seg.bearing || ''}
                              placeholder="e.g. N 45 30 E"
                              onChange={e => handleSegmentChange(idx, 'bearing', e.target.value)}
                            />
                          </td>
                          <td className="px-2.5 py-2">
                            <div className="flex items-center gap-1 font-mono">
                              <input
                                type="number"
                                step="0.01"
                                className="w-20 bg-transparent border-b border-dashed dark:text-white outline-none font-bold text-right"
                                value={seg.distance}
                                onChange={e => handleSegmentChange(idx, 'distance', e.target.value)}
                              />
                              <span className="text-gray-400">m</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSegment(idx)}
                              className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"
                              title="Delete segment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Table Footer Actions */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleAddSegment}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100 transition cursor-pointer font-semibold"
                  >
                    <Plus size={13} /> Add Line Segment
                  </button>
                  <button
                    onClick={saveSegments}
                    disabled={isSaving || segments.length < 3}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Recalculate & Save Geometry
                  </button>
                </div>
              </div>

              {/* GIS Map Preview with Numbered Points & Distances */}
              <div className="h-56 border-t border-gray-200 dark:border-gray-700 relative bg-gray-100 dark:bg-gray-900">
                <div className="absolute top-2 left-2 z-[1000] bg-white/95 dark:bg-gray-800/95 px-2.5 py-1 rounded-lg shadow text-xs font-bold flex items-center gap-1.5 dark:text-white border border-gray-200 dark:border-gray-700">
                  <MapPin size={14} className="text-emerald-500" />
                  <span>Reconstructed Cadastral Lot Boundary</span>
                </div>
                <MapContainer
                  center={[8.834, 124.786]}
                  zoom={18}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  {polygonGeo && (
                    <>
                      {/* High-Contrast Halo */}
                      <Polygon
                        positions={polygonGeo.positions}
                        pathOptions={{ color: '#020617', weight: 6, opacity: 0.95, fill: false }}
                      />
                      {/* Vivid Polygon */}
                      <Polygon
                        positions={polygonGeo.positions}
                        pathOptions={{
                          color: '#10b981',
                          weight: 3,
                          fillColor: '#10b981',
                          fillOpacity: 0.35
                        }}
                      />
                      {/* Numbered Corner Markers: 1, 2, 3, 4 */}
                      {polygonGeo.vertices.map((pos, idx) => (
                        <Marker
                          key={`corner-${idx}`}
                          position={pos}
                          icon={createCornerPointIcon(idx + 1, true)}
                        />
                      ))}
                      {/* Consecutive Side Length Badges: 1–2, 2–3, etc. */}
                      {polygonGeo.edges.map((edge, idx) => (
                        <Marker
                          key={`edge-${idx}`}
                          position={edge.mid}
                          icon={createSideLengthIcon(edge.dist, edge.label)}
                          interactive={false}
                        />
                      ))}
                    </>
                  )}
                </MapContainer>
              </div>

              {/* Direct GIS Save & Submit Actions */}
              <div className="p-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Property ID"
                    value={targetPropertyId}
                    onChange={e => setTargetPropertyId(e.target.value)}
                    className="w-28 px-2.5 py-1 text-xs border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono"
                    title="Enter Property ID to map directly to GIS"
                  />
                  <button
                    type="button"
                    onClick={handleSendToGIS}
                    disabled={isSendingToGis || !targetPropertyId || !polygonGeo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingToGis ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                    Map Lot in GIS
                  </button>
                </div>

                <button
                  onClick={submitForApproval}
                  disabled={
                    activeScan.status !== 'draft' ||
                    (activeScan.closure_error || 0) > 1.0 ||
                    activeScan.municipality?.toUpperCase() !== 'LAGONGLONG'
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow"
                >
                  <Check size={14} />
                  {userRole === 'admin' || userRole === 'super_admin'
                    ? 'Save Official Property Record'
                    : 'Submit Lot for Approval'}
                </button>
              </div>
            </div>
          ) : (
            <div className="m-auto text-center text-gray-400 p-8">
              <FileImage size={40} className="mx-auto mb-2 opacity-30" />
              <p>Select a survey plan to view extracted technical description</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
