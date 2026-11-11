import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MATCHER_API = 'http://127.0.0.1:4000';
const STRICT_MODE_TEARDOWN_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

const FINGER_NAMES = ['Primary Finger', 'Secondary Finger'];

function EnrollFingerprintModal({ employee, onClose }) {
  const [currentFingerIndex, setCurrentFingerIndex] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [samples, setSamples] = useState([]);
  const [collectedTemplates, setCollectedTemplates] = useState([]);
  const [status, setStatus] = useState(`Place your finger on the scanner for ${FINGER_NAMES[0]} - Scan 1/3`);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');

  const sdkRef = useRef(null);
  const teardownTimerRef = useRef(null);
  const handleSampleRef = useRef(null);

  const handleSample = useCallback(async (event) => {
    if (enrolling || scanCount >= 3) return;

    try {
      const parsed = typeof event.samples === 'string' ? JSON.parse(event.samples) : event.samples;
      const rawSample = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!rawSample) throw new Error('No sample data received.');

      // Clean the base64: remove any data:image/...;base64, prefix
      let imageBase64 = window.Fingerprint.b64UrlTo64(rawSample);
      if (imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
      }

      const newSamples = [...samples, imageBase64];
      setSamples(newSamples);

      const nextCount = newSamples.length;
      setScanCount(nextCount);

      if (nextCount < 3) {
        setStatus(`${FINGER_NAMES[currentFingerIndex]} - Scan ${nextCount}/3 complete. Lift and re-place your finger.`);
      } else {
        setEnrolling(true);
        setStatus(`Processing ${FINGER_NAMES[currentFingerIndex]} template...`);

        let result;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

          const res = await fetch(`${MATCHER_API}/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: newSamples }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`Server responded with status ${res.status}`);
          }
          result = await res.json();

          if (!result.success) {
            throw new Error(result.error || 'Enrollment failed on the server.');
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new Error('Matcher server timed out. Please check if the backend is running.');
          }
          throw err;
        }

        const newCollected = [...collectedTemplates, result.template];
        setCollectedTemplates(newCollected);

        if (newCollected.length === 2) {
          setStatus('✅ Both fingerprints enrolled successfully! Saving to database...');
          try {
            const docRef = doc(db, 'fingerprints', employee.id);
            await setDoc(docRef, {
              employeeId: employee.id,
              templates: newCollected,
              enrolledAt: new Date().toISOString(),
            });
          } catch (firestoreErr) {
            console.error('Firestore save failed:', firestoreErr);
            throw new Error('Failed to save to database. Check Firestore permissions.');
          }

          // Sync to matcher
          try {
            await fetch(`${MATCHER_API}/load-templates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employeeId: employee.id, templates: newCollected }),
            });
          } catch (syncErr) {
            console.error('Failed to sync templates to matcher:', syncErr);
          }

          setTimeout(() => onClose(), 1500);
        } else {
          setCurrentFingerIndex(1);
          setSamples([]);
          setScanCount(0);
          setEnrolling(false);
          setStatus(`${FINGER_NAMES[1]} - Scan 1/3`);
        }
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setError(err.message || 'Failed to capture fingerprint. Try again.');
      setStatus('❌ Error during capture. Press "Retry" to start over.');
      setEnrolling(false);
    }
  }, [samples, scanCount, currentFingerIndex, collectedTemplates, enrolling, employee.id, onClose]);

  useEffect(() => {
    handleSampleRef.current = handleSample;
  }, [handleSample]);

  useEffect(() => {
    let mounted = true;

    if (!sdkRef.current) {
      if (!window.Fingerprint || !window.Fingerprint.WebApi) {
        setStatus('Fingerprint SDK did not load. Please restart the app.');
        return;
      }

      const sdk = new window.Fingerprint.WebApi();
      sdkRef.current = sdk;

      sdk.onDeviceConnected = () => {
        if (mounted) setStatus(`${FINGER_NAMES[0]} - Scan 1/3`);
      };
      sdk.onDeviceDisconnected = () => {
        if (mounted) setStatus('Scanner disconnected. Check USB cable.');
      };
      sdk.onCommunicationFailed = () => {
        if (mounted) setStatus('Cannot reach DigitalPersona agent.');
      };
      sdk.onErrorOccurred = (event) => {
        if (mounted) setStatus(`Reader error: ${event.error || 'unknown'}`);
      };
      sdk.onSamplesAcquired = (event) => {
        if (handleSampleRef.current) {
          handleSampleRef.current(event);
        }
      };

      sdk.startAcquisition(window.Fingerprint.SampleFormat.PngImage)
        .then(() => {
          if (mounted) setStatus(`${FINGER_NAMES[0]} - Scan 1/3`);
        })
        .catch((err) => {
          console.error('SDK start failed:', err);
          sdkRef.current = null;
          if (mounted) {
            setError('Cannot connect to the fingerprint reader. Please ensure the DigitalPersona Lite Client is running on this PC.');
            setStatus('❌ Error: DigitalPersona Lite Client not running.');
          }
        });
    }

    return () => {
      mounted = false;
      teardownTimerRef.current = setTimeout(() => {
        if (sdkRef.current) {
          try { sdkRef.current.stopAcquisition(); } catch (e) {}
          sdkRef.current = null;
        }
        teardownTimerRef.current = null;
      }, STRICT_MODE_TEARDOWN_DELAY_MS);
    };
  }, []);

  const handleRetry = () => {
    setCurrentFingerIndex(0);
    setScanCount(0);
    setSamples([]);
    setCollectedTemplates([]);
    setEnrolling(false);
    setError('');
    setStatus(`${FINGER_NAMES[0]} - Scan 1/3`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-main" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-accent mb-2">
          <img src="/fingerprint-icon.png" alt="" className="w-6 h-6 inline-block align-middle mr-2" />
          Enroll 2 Fingers
        </h2>
        <p className="text-muted text-sm mb-4">Enrolling: <strong className="text-main">{employee.name}</strong></p>

        {/* Overall Progress */}
        <div className="flex justify-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${collectedTemplates.length >= 1 ? 'bg-accent' : 'border border-main'}`}></span>
            <span className={`text-xs ${collectedTemplates.length >= 1 ? 'text-accent' : 'text-muted'}`}>Finger 1</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${collectedTemplates.length >= 2 ? 'bg-accent' : 'border border-main'}`}></span>
            <span className={`text-xs ${collectedTemplates.length >= 2 ? 'text-accent' : 'text-muted'}`}>Finger 2</span>
          </div>
        </div>

        {/* Current Finger Scan Progress */}
        <div className="flex justify-center gap-3 mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-all ${scanCount >= step ? 'bg-accent border-accent text-white' : 'border-main text-muted bg-input'}`}>
              {scanCount >= step ? '✓' : step}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted mb-2">
          Currently enrolling: <span className="font-semibold text-main">{collectedTemplates.length === 0 ? FINGER_NAMES[0] : FINGER_NAMES[1]}</span>
        </p>

        <div className="flex justify-center my-4">
          <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center text-4xl transition-all ${enrolling || scanCount < 3 ? 'border-[var(--accent)] bg-accent-light animate-pulse' : 'border-main bg-input'}`}>
            {enrolling || scanCount < 3 ? (
              <img src="/fingerprint-icon.png" alt="Scanning" className="w-10 h-10 object-contain" />
            ) : (
              '✓'
            )}
          </div>
        </div>

        <p className="text-center text-sm text-main mb-2 h-6">{status}</p>
        {error && <p className="text-center text-[var(--accent-red)] text-sm mb-4">{error}</p>}

        <div className="flex gap-2 mt-4">
          {error && (
            <button onClick={handleRetry} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition">
              🔄 Retry
            </button>
          )}
          <button onClick={onClose} disabled={enrolling} className={`${error ? 'flex-1' : 'w-full'} py-2.5 bg-input text-muted rounded-xl font-medium hover:bg-card transition disabled:opacity-50`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default EnrollFingerprintModal;
