// Command main compiles to WebAssembly (GOOS=js GOARCH=wasm) and runs
// entirely in the browser: no Go server involved. It implements a small
// rule-based anomaly detector over a rolling window of utility-meter-style
// telemetry (voltage, flow rate), in the same spirit as the deterministic
// anomaly engine described for the Netflow project elsewhere in this
// portfolio, adapted here into a minimal, dependency-free demo.
package main

import (
	"math"
	"syscall/js"
)

const (
	windowSize      = 20
	zScoreThreshold = 4.0
	voltageLow      = 200.0
	voltageHigh     = 240.0
	flowSpikeFactor = 3.0
)

// reading is one telemetry sample.
type reading struct {
	voltage float64
	flow    float64
}

var window []reading

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

func stddev(xs []float64, m float64) float64 {
	if len(xs) < 2 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		d := x - m
		sum += d * d
	}
	return math.Sqrt(sum / float64(len(xs)-1))
}

// analyze runs three independent, explainable checks against the rolling
// window and returns a JS array of anomaly-label strings (empty if none).
func analyze(this js.Value, args []js.Value) any {
	v := args[0].Float()
	f := args[1].Float()

	window = append(window, reading{voltage: v, flow: f})
	if len(window) > windowSize {
		window = window[1:]
	}

	var flows, voltages []float64
	for _, r := range window {
		flows = append(flows, r.flow)
		voltages = append(voltages, r.voltage)
	}

	var anomalies []any

	// 1. Hard voltage-range check (matches a grid under/over-voltage fault).
	if v < voltageLow || v > voltageHigh {
		anomalies = append(anomalies, "voltage_out_of_range")
	}

	// 2. Rolling z-score on flow: catches a sudden spike/drop relative to
	// this device's own recent behaviour, not a fixed global threshold.
	if len(flows) >= 5 {
		m := mean(flows[:len(flows)-1])
		sd := stddev(flows[:len(flows)-1], m)
		if sd > 0.01 {
			z := (f - m) / sd
			if math.Abs(z) > zScoreThreshold {
				anomalies = append(anomalies, "flow_zscore_spike")
			}
		}
	}

	// 3. Sustained-high-flow check: a naive threshold would fire on one
	// noisy sample, so this requires the last 3 samples to all exceed the
	// window's baseline by flowSpikeFactor before flagging it.
	if len(flows) >= 4 {
		baseline := mean(flows[:len(flows)-3])
		if baseline > 0.01 {
			last3 := flows[len(flows)-3:]
			allHigh := true
			for _, x := range last3 {
				if x < baseline*flowSpikeFactor {
					allHigh = false
					break
				}
			}
			if allHigh {
				anomalies = append(anomalies, "sustained_flow_spike")
			}
		}
	}

	return js.ValueOf(anomalies)
}

func main() {
	c := make(chan struct{})
	js.Global().Set("goAnalyze", js.FuncOf(analyze))
	js.Global().Set("goReady", js.ValueOf(true))
	<-c
}
