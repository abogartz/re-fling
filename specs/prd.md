# ReFling - PRD

## Executive Summary
ReFling is a an application designed to replay historical traffic patterns exactly as they occurred, including natural spikes and valleys. The tool is specifically built to reproduce race conditions and timing-sensitive bugs by maintaining the precise temporal characteristics of original request sequences.

## Product Overview
**Target Audience:** Developers, QA engineers, SREs working with timing-sensitive applications
**Primary Use Case:** Bug reproduction and race condition debugging using real historical traffic patterns

## Key Features & Requirements

### Core Functionality
- [ ] Implement CSV parser for timestamped requests (datetime, URL)
- [ ] Create exact timing replay engine with min/max bounds (1ms min, 10s max)
- [ ] Preserve exact inter-row timing gaps when repeating data to fill duration (no uniform spacing)
- [ ] Add playback speed control (slider)
- [ ] Build URL filtering capability

### Input/Output Support  
- [ ] CSV input with datetime and URL fields
- [ ] Configurable format transformations with GUI mapping
- [ ] Sample CSV generator for testing

### User Interface
- [ ] Desktop GUI
- [ ] Single screen layout (no scrolling)
- [ ] Progress bar and clock display during replay
- [ ] Real-time statistics dashboard (RPS, total requests)
- [ ] Preview mode with timing histogram visualization as line chart (sampled for performance, using Chart.js)
- [ ] CSV upload via browse button (not drag/drop)
- [ ] Column transformation UI with expected vs found fields mapping

### Advanced Features
- [ ] Iteration control (run Y times)
- [ ] Total duration control (run for X duration and stop or extend (repeat) regardless of entries)
- [ ] When repeating data to fill duration: preserve original inter-row timing gaps, place cycles back-to-back
- [ ] Cancel button for stopping replays
- [ ] Base URL prefix functionality for URL path reconstruction

### Technical Requirements
- [ ] Bun-based application with efficient memory usage (max 1GB file size)
- [ ] Thread-safe replay engine
- [ ] Error handling for malformed requests (skip and continue with user notification)
- [ ] Strict TDD approach - tests first, then code implementation

## User Stories

### As a developer, I want to replay 10 minutes of production traffic for 30 minutes total so that I can reproduce a race condition consistently.

### As a QA engineer, I want to preview traffic patterns before replaying so that I understand the timing distribution.

### As an SRE, I want to run replays at 2x speed during testing so that I can validate performance without waiting.

## Acceptance Criteria
- [ ] CSV parsing handles standard timestamp formats (ISO, Unix timestamps)
- [ ] Replay maintains original timing gaps within bounds (1ms min, 10s max)
- [ ] Preview histogram accurately represents traffic pattern distribution
- [ ] Playback speed controls work correctly (0.5x, 1x, 2x)
- [ ] URL filtering excludes specified patterns from replay
- [ ] Memory usage stays within reasonable limits (max 1GB file size)
- [ ] Invalid rows are counted and displayed during CSV load with user notifications
- [ ] TDD approach verified through comprehensive test coverage

## Technical Architecture
**Primary Language:** Typescript
**GUI Framework:** Electrobun (Electron for Bunm)
**HTTP Client:** Best available
**Testing Approach:** Strict TDD methodology - all new code must have tests first
**Future Expansion:** CLI version for containerized environments

## Success Metrics
- [ ] Successful replay of 100K+ requests without memory issues (max 1GB)
- [ ] <5% timing variance from original patterns  
- [ ] User feedback on preview mode effectiveness
- [ ] 90%+ success rate in reproducing reported race conditions

## Timeline & Milestones
- **Phase 1:** Basic CSV parsing and timing replay (Weeks 1-2)
- **Phase 2:** GUI implementation with progress indicators (Weeks 3-4)  
- **Phase 3:** Playback speed, filtering, and preview features (Weeks 5-6)
- **Phase 4:** Memory monitoring and CLI support (Weeks 7-8)

## Risk Assessment
**High Priority Risks:**
- Memory issues with large datasets (mitigated by 1GB limit and monitoring)
- Timing precision challenges with system clock variations
- GUI performance bottlenecks with heavy traffic replay (mitigated by sampling)
- Async implementation complexity leading to subtle bugs

## Implementation Tasks
- [ ] Implement CSV parser for timestamped requests (datetime, URL)
- [ ] Create exact timing replay engine with min/max bounds (1ms min, 10s max)
- [ ] Build playback speed control
- [ ] Implement URL filtering capability
- [ ] Implement memory monitoring for large datasets (max 1GB file size)
- [ ] CSV input with datetime and URL fields
- [ ] Configurable format transformations with GUI mapping
- [ ] Sample CSV generator for testing
- [ ] Desktop GUI using React framework
- [ ] Single page layout: Input/CSV, Preview, Replay Settings, Run
- [ ] Progress bar and clock display during replay (smooth animations)
- [ ] Real-time statistics dashboard (RPS, total requests, progress across histogram)
- [ ] Preview mode with timing histogram visualization (sampled for performance)
- [ ] CSV upload via browse button (not drag/drop)
- [ ] Column transformation UI with expected vs found fields mapping
- [ ] Iteration control
- [ ] Duration control
- [ ] Cancel button for stopping replays
- [ ] Base URL prefix functionality for URL path reconstruction
- [ ] Bun-based application with efficient memory usage (max 1GB file size)
- [ ] Thread-safe replay engine
- [ ] Error handling for malformed requests (skip and continue with user notification)
- [ ] Strict TDD approach - tests first, then code implementation
- [ ] CLI version for CI/CD and ECS integration (future)

## Configurable Parameters
- Input file format (CSV/JSON)
- Playback speed 
- Duration
- URL filter patterns
- Memory limit thresholds (max 1GB file size)
- Base URL prefix for path reconstruction

## Limitations & Notes
**Timing Accuracy:** While ReFling attempts to maintain exact timing patterns, network latency variations between original and replay environments may affect race condition reproduction. This tool is intended as a best-effort recreation of traffic patterns for debugging purposes.

**Repeating Behavior:** When duration exceeds CSV span, data repeats in cycles preserving original inter-row gaps. Cycles are placed back-to-back with no gap between them. This preserves natural traffic spikes/valleys unlike uniform-spacing tools (k6, etc.).

**Performance Considerations:** Preview histograms use sampling to maintain GUI responsiveness across large datasets. Very large files (exceeding 1GB) will be rejected to prevent memory issues.

**Performance Considerations:** Preview histograms use sampling to maintain GUI responsiveness across large datasets. Very large files (exceeding 1GB) will be rejected to prevent memory issues.

## Next Steps
1. Implement CSV parser and core timing engine  
2. Build basic GUI with progress indicators
3. Add preview histogram visualization
4. Implement playback speed controls and filtering
5. Test with sample data sets

---