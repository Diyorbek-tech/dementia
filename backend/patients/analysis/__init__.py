"""Multimodal analysis package.

Each module turns one raw modality into a calibrated risk score plus
interpretable biomarkers:

- ``eeg``      — band-power features + a trained scikit-learn classifier
- ``speech``   — acoustic (librosa/parselmouth) + linguistic (Whisper + spaCy)
- ``face``     — facial expressivity / blink (MediaPipe + OpenCV)
- ``clinical`` — questionnaire + MMSE/MoCA rule-based scorer
- ``fusion``   — explainable late fusion of the available modalities

Heavy third-party libraries are imported lazily inside functions so this
package imports cleanly even where those libraries are absent (e.g. host test
runs); the Celery worker image has them all installed.
"""
