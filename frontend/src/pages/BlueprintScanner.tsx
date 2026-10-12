import { useState, useEffect, useRef } from 'react';
import { Upload, FileImage, ZoomIn, ZoomOut, Check, AlertTriangle, Save, Loader2, MapPin } from 'lucide-react';
import api, { ensureSession } from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { MapContainer, TileLayer, Polygon, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapController = ({ bounds, zoom, setZoom, fitTrigger }: { bounds: any, zoom: number, setZoom: any, fitTrigger: number }) => {
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
    return () => { map.off('zoomend', onZoom); };
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
    } catch (e) {
      showError('Failed to load scan history.');
    }
  };

  const loadActiveScan = async (id: number) => {
    try {
      const { data } = await api.get(`/scanner/${id}`);
      setActiveScan(data.blueprint);
      setOwnerName(data.blueprint.owner_name || '');
      setSegments(data.segments);
    } catch (e) {
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
      // Auto-load it after a short delay since processing is async
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

  const saveSegments = async () => {
    if (!activeScan) return;
    setIsSaving(true);
    try {
      const { data } = await api.put(`/scanner/${activeScan.scan_id}/segments`, { segments });
      setActiveScan({
        ...activeScan,
        calculated_area: data.calculated_area,
        closure_error: data.closure_error,
        gis_geometry: data.gis_geometry
      });
      setSegments(data.segments);
      showSuccess('Geometry recalculated and saved.');
    } catch (e) {
      showError('Failed to save segments');
    } finally {
      setIsSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!activeScan) return;
    const confirmMessage = userRole === 'admin' || userRole === 'super_admin' ? 'Save this blueprint as an official property record?' : 'Submit this blueprint for Admin approval to create a new lot?';
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
      } catch (e) {
        showError('Submission failed.');
      }
    });
  };

  const renderPolygon = () => {
    if (!activeScan?.gis_geometry?.coordinates) return null;
    let coords = activeScan.gis_geometry.coordinates[0];
    if (!coords || coords.length === 0) return null;

    // Convert arbitrary Cartesian to arbitrary Geo (for local preview)
    // We'll center at 0,0 and scale it very small to fit a Leaflet map
    const boundsCenter: [number, number] = [8.834, 124.786];
    const scale = 0.000008983; // Approx degrees per meter at equator

    const leafletPositions = coords.map((c: number[]) => [
      boundsCenter[0] + c[1] * scale, // Lat (Y)
      boundsCenter[1] + c[0] * scale  // Lng (X)
    ]);

    return (
      <Polygon positions={leafletPositions} pathOptions={{ color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.5 }} />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cadastral Blueprint Scanner</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Upload, OCR, and verify technical survey plans.</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} Upload Plan
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* LEFT COLUMN: Document Viewer + Scan History */}
        <div className="lg:w-1/2 w-full flex flex-col gap-6">
          <div className="flex-1 min-h-[500px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <FileImage size={18} /> Document Preview
            </h3>
            {activeScan && (
              <div className="flex gap-2 items-center">
                <button onClick={() => setZoom(z => z - 0.5)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ZoomOut size={18} className="dark:text-white" /></button>
                <span className="text-sm dark:text-gray-300 self-center w-10 text-center">{Math.round(Math.pow(2, zoom) * 100)}%</span>
                <button onClick={() => setZoom(z => z + 0.5)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ZoomIn size={18} className="dark:text-white" /></button>
                <button onClick={() => setFitTrigger(f => f + 1)} className="ml-2 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition">Fit to Screen</button>
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
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 h-[300px] shrink-0 flex flex-col">
            <h3 className="font-bold text-lg dark:text-white mb-4 shrink-0">Scan History</h3>
            <div className="flex-1 overflow-y-auto pr-2 min-h-0">
              <div className="grid grid-cols-1 gap-4">
              {scans.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  No scan history available. Upload a blueprint to begin.
                </div>
              ) : scans.map(s => (
                <div key={s.scan_id} onClick={() => loadActiveScan(s.scan_id)} className={`border rounded-lg p-4 cursor-pointer transition ${activeScan?.scan_id === s.scan_id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md bg-white dark:bg-gray-800'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2" title={s.original_filename}>{s.original_filename}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${s.status === 'processing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50' : s.status === 'pending_approval' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50' : s.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/50' : 'bg-gray-100 text-gray-600 dark:bg-gray-700'}`}>
                      {s.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex justify-between mt-2">
                    <span>Lot: <strong>{s.lot_number || 'N/A'}</strong></span>
                    <span>{s.municipality || 'N/A'}, {s.barangay || 'N/A'}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {new Date(s.upload_date).toLocaleString()}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Extraction & GIS */}
        <div className="lg:w-1/2 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          {activeScan ? (
            <div className="flex flex-col">
              {/* Properties Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-bold text-lg dark:text-white mb-3">Survey & Lot Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Owner Name</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Lot Number</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.lot_number || ''} onChange={e => setActiveScan({ ...activeScan, lot_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cadastral Ref</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.cad_reference || ''} onChange={e => setActiveScan({ ...activeScan, cad_reference: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Barangay</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.barangay || ''} onChange={e => setActiveScan({ ...activeScan, barangay: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Municipality</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.municipality || ''} onChange={e => setActiveScan({ ...activeScan, municipality: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Province</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.province || ''} onChange={e => setActiveScan({ ...activeScan, province: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Survey Date</label>
                    <input className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.survey_date || ''} onChange={e => setActiveScan({ ...activeScan, survey_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Stated Area (sqm)</label>
                    <input type="number" className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={activeScan.stated_area || ''} onChange={e => setActiveScan({ ...activeScan, stated_area: parseFloat(e.target.value) })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div><span className="text-gray-500 block">Calculated Area</span><strong className={Math.abs((activeScan.stated_area || 0) - (activeScan.calculated_area || 0)) > 2 ? 'text-red-500' : 'text-green-600'}>{activeScan.calculated_area} sqm</strong></div>
                  <div>
                    <span className="text-gray-500 block">Traverse Closure</span>
                    {activeScan.closure_error !== undefined ? (
                      <strong className={activeScan.closure_error > 0.5 ? 'text-red-500 flex items-center gap-1' : 'text-green-600 flex items-center gap-1'}>
                        {activeScan.closure_error}m {activeScan.closure_error > 0.5 && <AlertTriangle size={14} />}
                      </strong>
                    ) : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 p-4">
                <table className="w-full text-sm text-left dark:text-gray-300">
                  <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="px-2 py-2">Line</th>
                      <th className="px-2 py-2">Bearing</th>
                      <th className="px-2 py-2">Distance (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.length === 0 ? (
                      <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-500">No segments extracted. OCR might have failed.</td></tr>
                    ) : segments.map((seg, idx) => (
                      <tr key={idx} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-2 py-2 font-medium">
                          <input className="w-12 bg-transparent border-b border-dashed dark:text-white outline-none" value={`${seg.from_point}-${seg.to_point}`} onChange={e => {
                            const [f, t] = e.target.value.split('-');
                            handleSegmentChange(idx, 'from_point', f);
                            handleSegmentChange(idx, 'to_point', t || '');
                          }} />
                        </td>
                        <td className="px-2 py-2">
                          <input className={`w-24 bg-transparent border-b border-dashed dark:text-white outline-none ${seg.is_corrected ? 'text-blue-600 dark:text-blue-400' : ''}`} value={seg.bearing} onChange={e => handleSegmentChange(idx, 'bearing', e.target.value)} />
                        </td>
                        <td className="px-2 py-2 flex items-center gap-2">
                          <input type="number" step="0.01" className={`w-20 bg-transparent border-b border-dashed dark:text-white outline-none ${seg.is_corrected ? 'text-blue-600 dark:text-blue-400' : ''}`} value={seg.distance} onChange={e => handleSegmentChange(idx, 'distance', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {segments.length > 0 && (
                  <button onClick={saveSegments} disabled={isSaving} className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition text-sm">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Validate & Recalculate
                  </button>
                )}
              </div>

              {/* GIS Map Preview */}
              <div className="h-48 border-t border-gray-200 dark:border-gray-700 relative bg-gray-100 dark:bg-gray-900">
                <div className="absolute top-2 left-2 z-[1000] bg-white/90 dark:bg-gray-800/90 px-2 py-1 rounded shadow text-xs font-semibold flex items-center gap-1 dark:text-white">
                  <MapPin size={14} /> Reconstructed Polygon
                </div>
                <MapContainer center={[8.834, 124.786]} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  {renderPolygon()}
                </MapContainer>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <div className="flex flex-col">
                  {activeScan.municipality?.toUpperCase() !== 'LAGONGLONG' && (
                    <span className="text-red-500 text-xs font-medium">Validation Error: Only properties in Lagonglong are accepted.</span>
                  )}
                  {activeScan.closure_error > 1.0 && (
                    <span className="text-red-500 text-xs font-medium">Validation Error: Traverse closure error is too high.</span>
                  )}
                </div>
                <button
                  onClick={submitForApproval}
                  disabled={activeScan.status !== 'draft' || activeScan.closure_error > 1.0 || activeScan.municipality?.toUpperCase() !== 'LAGONGLONG'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Check size={16} /> {userRole === 'admin' || userRole === 'super_admin' ? 'Save Property Record' : 'Submit Lot for Admin Approval'}
                </button>
              </div>
            </div>
          ) : (
            <div className="m-auto text-center text-gray-400">
              <p>Select a scan to view data</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
