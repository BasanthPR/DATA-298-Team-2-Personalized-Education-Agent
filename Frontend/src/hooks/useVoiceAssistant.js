import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoiceAssistant(onResult, autoRestart = true) {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);
    const shouldListenRef = useRef(false);
    const onResultRef = useRef(onResult);

    // Keep the latest callback without triggering effect restarts
    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setError('Speech Recognition is not supported in this browser. Please use Chrome or Safari.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // Must be false so it yields isFinal when user pauses
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
            setIsListening(true);
        };

        recognitionRef.current.onresult = (event) => {
            // The moment we detect audio input, stop the AI from talking
            window.speechSynthesis.cancel();
            
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            const transcript = finalTranscript || interimTranscript;
            const isFinal = finalTranscript.length > 0;

            if (onResultRef.current) {
                onResultRef.current(transcript, isFinal);
            }
        };

        recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
            if (shouldListenRef.current && autoRestart) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error("Auto-restart failed", e);
                }
            }
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            window.speechSynthesis.cancel();
        };
    }, [autoRestart]); // Removed onResult to prevent instance destruction on re-renders

    const startListening = useCallback(() => {
        shouldListenRef.current = true;
        if (recognitionRef.current && !isListening) {
            window.speechSynthesis.cancel(); // Stop AI from talking if user speaks
            
            // Resume/unlock AudioContext for TTS if needed
            if (window.speechSynthesis.resume) window.speechSynthesis.resume();
            
            setIsSpeaking(false);
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error(e);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    const speak = useCallback((text, onEndCallback, clearQueue = true) => {
        if (!('speechSynthesis' in window)) return;
        
        if (clearQueue) {
            window.speechSynthesis.cancel(); // Cancel any ongoing speech
        }
        
        const plainText = text.replace(/<[^>]+>/g, '').replace(/[*_#`]/g, ''); // Strip markdown
        if (!plainText.trim()) return; // Don't speak empty sentences
        const utterance = new SpeechSynthesisUtterance(plainText);
        
        // Try to find a good female English voice for tutor vibe
        const voices = window.speechSynthesis.getVoices();
        const tutorVoice = voices.find(v => v.name.includes('Google UK English Female')) || voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) || voices[0];
        if (tutorVoice) utterance.voice = tutorVoice;
        
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            if (onEndCallback) onEndCallback();
        };
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.speak(utterance);
    }, []);

    return {
        isListening,
        isSpeaking,
        startListening,
        stopListening,
        speak,
        error
    };
}
