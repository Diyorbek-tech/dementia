"""Tests for the multimodal analysis pipeline.

Pure-Python logic (clinical scorer, fusion, speech/face scoring, linguistic
features) is always tested. Tests that need heavy libraries (numpy/scipy/
scikit-learn for EEG, librosa for audio) are skipped where those libs are
absent, so host runs stay green while the Docker test run exercises everything.
"""
import importlib
import tempfile
import unittest

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APITestCase

from patients.analysis import clinical, fusion, speech as speech_mod, face as face_mod
from patients.analysis import eeg_synth
from patients.models import Patient, DiagnosisReport


def _have(mod):
    try:
        importlib.import_module(mod)
        return True
    except Exception:
        return False


HAS_NUMPY = _have("numpy")
HAS_SCIPY = _have("scipy")
HAS_SKLEARN = _have("sklearn")


# ── Clinical scorer ───────────────────────────────────────────────────────────
class ClinicalScorerTests(TestCase):
    def _patient(self, **kw):
        base = dict(age=70, gender="M", education_level="Higher", smoking_status="Never",
                    sleep_hours_per_day=7, physical_activity="Moderate")
        base.update(kw)
        return base

    def test_low_risk_healthy(self):
        r = clinical.score_clinical(self._patient(age=40))
        self.assertEqual(r["predicted_status"], clinical.NORMAL)
        self.assertLessEqual(r["risk"], 35)

    def test_high_risk_accumulates(self):
        r = clinical.score_clinical(self._patient(
            age=80, family_history_of_alzheimers=True, history_of_stroke=True,
            memory_complaints=True, mmse_score=18, moca_score=15))
        self.assertGreaterEqual(r["risk"], 71)
        self.assertEqual(r["predicted_status"], clinical.AD)

    def test_factors_reported_and_sorted(self):
        r = clinical.score_clinical(self._patient(age=80, diabetes=True))
        self.assertTrue(r["factors"])
        pts = [f["points"] for f in r["factors"]]
        self.assertEqual(pts, sorted(pts, reverse=True))

    def test_determinism(self):
        p = self._patient(age=68, hypertension=True)
        self.assertEqual(clinical.score_clinical(p), clinical.score_clinical(p))

    def test_recommendations_english(self):
        self.assertIn("neurologist", clinical.get_recommendations(clinical.AD))
        self.assertIn("low", clinical.get_recommendations(clinical.NORMAL).lower())


# ── Fusion engine ─────────────────────────────────────────────────────────────
class FusionTests(TestCase):
    def test_all_modalities(self):
        out = fusion.fuse({"speech": 80, "eeg": 70, "clinical": 60, "face": 50})
        self.assertEqual(sorted(out["weights"]), ["clinical", "eeg", "face", "speech"])
        self.assertAlmostEqual(sum(out["weights"].values()), 1.0, places=3)
        self.assertEqual(len(out["contributions"]), 4)

    def test_missing_modalities_renormalize(self):
        out = fusion.fuse({"speech": 80, "eeg": None, "clinical": 40, "face": None})
        self.assertEqual(set(out["modalities_used"]), {"speech", "clinical"})
        self.assertAlmostEqual(sum(out["weights"].values()), 1.0, places=3)
        self.assertTrue(40 <= out["overall_risk"] <= 80)

    def test_status_thresholds(self):
        self.assertEqual(fusion.fuse({"clinical": 10})["predicted_status"], clinical.NORMAL)
        self.assertEqual(fusion.fuse({"clinical": 50})["predicted_status"], clinical.MCI)
        self.assertEqual(fusion.fuse({"clinical": 90})["predicted_status"], clinical.AD)

    def test_empty(self):
        out = fusion.fuse({})
        self.assertEqual(out["modalities_used"], [])
        self.assertEqual(out["confidence"], 0.0)

    def test_confidence_increases_with_coverage(self):
        one = fusion.fuse({"clinical": 50})["confidence"]
        four = fusion.fuse({"speech": 50, "eeg": 50, "clinical": 50, "face": 50})["confidence"]
        self.assertGreater(four, one)


# ── Speech / Face scoring (pure, no media) ────────────────────────────────────
class SpeechScoringTests(TestCase):
    def test_linguistic_features_basic(self):
        text = "The quick brown fox jumps over the lazy dog. It runs fast."
        feats = speech_mod._linguistic_features(text, duration_s=6.0)
        self.assertEqual(feats["word_count"], 12)
        self.assertGreater(feats["type_token_ratio"], 0.5)
        self.assertGreater(feats["words_per_min"], 0)

    def test_score_monotonic_in_pauses(self):
        ling = {"words_per_min": 120, "type_token_ratio": 0.6, "filler_ratio": 0.0, "syntactic_depth": 4}
        low, _, _ = speech_mod.score_speech({"pause_ratio": 0.2}, ling)
        high, _, _ = speech_mod.score_speech({"pause_ratio": 0.6}, ling)
        self.assertGreater(high, low)


class FaceScoringTests(TestCase):
    def test_low_expressivity_higher_risk(self):
        good = {"frames_analyzed": 50, "detection_rate": 0.9, "expressivity": 0.05,
                "blink_rate_per_min": 15, "head_movement": 0.02}
        poor = {"frames_analyzed": 50, "detection_rate": 0.9, "expressivity": 0.005,
                "blink_rate_per_min": 4, "head_movement": 0.002}
        self.assertGreater(face_mod.score_face(poor)[0], face_mod.score_face(good)[0])

    def test_insufficient_detection(self):
        risk, _, bio = face_mod.score_face({"frames_analyzed": 1, "detection_rate": 0.05})
        self.assertEqual(risk, 1.0)
        self.assertEqual(bio[0]["status"], "low")


# ── EEG synthetic generator + features ────────────────────────────────────────
class EegSynthTests(TestCase):
    @unittest.skipUnless(HAS_NUMPY, "numpy required")
    def test_dataframe_shape(self):
        df = eeg_synth.generate_dataframe(0, n_seconds=2, fs=128, seed=1)
        self.assertEqual(len(df), 256)
        self.assertIn("Fp1", df.columns)
        self.assertIn("status", df.columns)


@unittest.skipUnless(HAS_NUMPY and HAS_SCIPY, "numpy+scipy required")
class EegFeatureTests(TestCase):
    def _signal(self, code):
        import numpy as np
        cols = eeg_synth.generate_eeg(code, n_seconds=4, fs=256, seed=7)
        channels = list(cols.keys())
        sig = np.stack([cols[c] for c in channels], axis=1)
        return sig, channels

    def test_band_directions(self):
        from patients.analysis import eeg
        normal, ch = self._signal(0)
        ad, _ = self._signal(2)
        fn = eeg.extract_features(normal, 256, ch)
        fa = eeg.extract_features(ad, 256, ch)
        self.assertGreater(fn["rel_alpha"], fa["rel_alpha"])
        self.assertGreater(fa["ratio_slowing"], fn["ratio_slowing"])

    def test_feature_vector_length(self):
        from patients.analysis import eeg
        sig, ch = self._signal(1)
        feats = eeg.extract_features(sig, 256, ch)
        self.assertEqual(len(eeg.features_to_vector(feats)), len(eeg.FEATURE_NAMES))


@unittest.skipUnless(HAS_NUMPY and HAS_SCIPY and HAS_SKLEARN, "numpy+scipy+sklearn required")
class EegAnalyzeTests(TestCase):
    def test_analyze_generated_csv(self):
        from patients.analysis import eeg
        if eeg.load_model() is None:
            self.skipTest("EEG model not trained in this environment")
        df = eeg_synth.generate_dataframe(2, n_seconds=8, fs=256, seed=3, with_label=False)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            df.to_csv(f.name, index=False)
            path = f.name
        result = eeg.analyze_eeg(path)
        self.assertIn("risk", result)
        self.assertIn(result["predicted_class"], ("Normal", "MCI", "AD"))
        self.assertAlmostEqual(sum(result["probabilities"].values()), 1.0, delta=0.05)
        self.assertTrue(result["waveform_preview"]["series"])
        self.assertGreater(result["band_powers"]["delta"], 0)


# ── API + orchestration ───────────────────────────────────────────────────────
class ApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@x.com", password="pw")
        self.client.force_authenticate(self.user)

    def _payload(self, **kw):
        base = dict(age=72, gender="M", education_level="Secondary", smoking_status="Never",
                    sleep_hours_per_day=7, physical_activity="Low",
                    memory_complaints=True, mmse_score=22)
        base.update(kw)
        return base

    def test_create_runs_clinical_and_fuses(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/patients/", self._payload(), format="multipart")
        self.assertEqual(res.status_code, 201)
        report = DiagnosisReport.objects.get(patient__id=res.data["id"])
        self.assertEqual(report.analysis_status, DiagnosisReport.DONE)
        self.assertEqual(report.modalities_used, ["clinical"])
        self.assertIsNotNone(report.risk_percentage)
        self.assertTrue(report.fusion_result)

    def test_report_polling_endpoint(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/patients/", self._payload(), format="multipart")
        pid = res.data["id"]
        rep = self.client.get(f"/api/patients/{pid}/report/")
        self.assertEqual(rep.status_code, 200)
        self.assertIn(rep.data["analysis_status"],
                      ("done", "partial", "processing", "pending", "failed"))
        self.assertIn("summary", rep.data)

    def test_ownership_isolation(self):
        other = User.objects.create_user(username="u2", password="pw")
        p = Patient.objects.create(user=other, age=60, gender="F", education_level="Higher",
                                   smoking_status="Never", sleep_hours_per_day=8, physical_activity="High")
        res = self.client.get(f"/api/patients/{p.id}/report/")
        self.assertEqual(res.status_code, 404)

    def test_download_sample_eeg(self):
        res = self.client.get("/api/eeg/sample/?cls=ad")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/csv")
        self.assertIn("Fp1", res.content.decode().splitlines()[0])
