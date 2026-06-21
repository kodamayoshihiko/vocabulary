import { 
  waitForEvenAppBridge, 
  TextContainerProperty, 
  CreateStartUpPageContainer, 
  TextContainerUpgrade,
  OsEventTypeList,
  EventSourceType
} from '@evenrealities/even_hub_sdk';
import { VocabApp } from './app';
import { clearStorageData, getEverWrongWordIds, getStorageData } from './storage';

// Initialize core application logic
const app = new VocabApp();

// HTML Elements for Browser Simulator
const g2ContentEl = document.getElementById('g2-content');
const stateScreenEl = document.getElementById('state-screen');
const stateSeenEl = document.getElementById('state-seen-words');
const stateWrongEl = document.getElementById('state-wrong-count');

// Interactive Buttons in Browser Developer Console
const btnSwipeUp = document.getElementById('btn-swipe-up');
const btnSwipeDown = document.getElementById('btn-swipe-down');
const btnClick = document.getElementById('btn-click');
const btnDoubleClick = document.getElementById('btn-double-click');
const btnResetStorage = document.getElementById('btn-reset-storage');

let bridge: any = null;

// Extract raw eventType value following the prioritized reading order:
// 1. textEvent.eventType
// 2. listEvent.eventType
// 3. jsonData.eventType
// 4. audioEvent.eventType
// 5. sysEvent.eventType
// 6. top-level eventType
// 7. top-level type
function getRawEventType(event: any): any {
  if (!event) return undefined;
  
  if (event.textEvent && event.textEvent.eventType !== undefined) {
    return event.textEvent.eventType;
  }
  if (event.listEvent && event.listEvent.eventType !== undefined) {
    return event.listEvent.eventType;
  }
  
  // Safely extract jsonData.eventType
  let jsonDataTypeVal: any = undefined;
  if (event.jsonData) {
    if (typeof event.jsonData === 'object' && event.jsonData.eventType !== undefined) {
      jsonDataTypeVal = event.jsonData.eventType;
    } else if (typeof event.jsonData === 'string') {
      try {
        const parsed = JSON.parse(event.jsonData);
        if (parsed && parsed.eventType !== undefined) {
          jsonDataTypeVal = parsed.eventType;
        }
      } catch (e) {}
    }
  }
  if (jsonDataTypeVal !== undefined) {
    return jsonDataTypeVal;
  }

  if (event.audioEvent && event.audioEvent.eventType !== undefined) {
    return event.audioEvent.eventType;
  }
  if (event.sysEvent && event.sysEvent.eventType !== undefined) {
    return event.sysEvent.eventType;
  }
  if (event.eventType !== undefined) {
    return event.eventType;
  }
  if (event.type !== undefined) {
    return event.type;
  }

  // Fallback: search key names representing event type recursively
  let foundVal: any = undefined;
  const targetKeys = ['eventtype', 'oseventtype', 'syseventtype', 'type', 'code', 'gesture', 'action'];

  function traverse(item: any) {
    if (foundVal !== undefined || item === null || item === undefined) return;
    if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          const keyLower = key.toLowerCase();
          if (targetKeys.includes(keyLower)) {
            foundVal = item[key];
            return;
          }
          traverse(item[key]);
        }
      }
    }
  }

  traverse(event);
  return foundVal;
}

// Extract raw eventSource value following the prioritized reading order
function getRawEventSource(event: any): any {
  if (!event) return undefined;
  if (event.sysEvent && event.sysEvent.eventSource !== undefined) {
    return event.sysEvent.eventSource;
  }
  if (event.textEvent && event.textEvent.eventSource !== undefined) {
    return event.textEvent.eventSource;
  }
  if (event.listEvent && event.listEvent.eventSource !== undefined) {
    return event.listEvent.eventSource;
  }
  if (event.audioEvent && event.audioEvent.eventSource !== undefined) {
    return event.audioEvent.eventSource;
  }
  if (event.eventSource !== undefined) {
    return event.eventSource;
  }
  if (event.source !== undefined) {
    return event.source;
  }

  // Fallback: search key names representing event source recursively
  let foundVal: any = undefined;
  const targetKeys = ['eventsource', 'source'];

  function traverse(item: any) {
    if (foundVal !== undefined || item === null || item === undefined) return;
    if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          const keyLower = key.toLowerCase();
          if (targetKeys.includes(keyLower)) {
            foundVal = item[key];
            return;
          }
          traverse(item[key]);
        }
      }
    }
  }

  traverse(event);
  return foundVal;
}

// Get readable labels for eventSource
function getEventSourceLabel(event: any): string {
  const sourceVal = getRawEventSource(event);
  
  if (sourceVal !== undefined) {
    const valStr = String(sourceVal).toLowerCase();
    
    // Check for Ring
    if (
      sourceVal === 2 || 
      sourceVal === '2' || 
      sourceVal === EventSourceType.TOUCH_EVENT_FROM_RING || 
      valStr === 'touch_event_from_ring' || 
      valStr.includes('ring')
    ) {
      return 'Ring';
    }
    
    // Check for Glasses Left
    if (
      sourceVal === 3 ||
      sourceVal === '3' ||
      sourceVal === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L ||
      valStr === 'touch_event_from_glasses_l' ||
      valStr.includes('glasses_l') ||
      valStr.includes('left')
    ) {
      return 'Glasses Left';
    }

    // Check for Glasses Right
    if (
      sourceVal === 1 ||
      sourceVal === '1' ||
      sourceVal === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R ||
      valStr === 'touch_event_from_glasses_r' ||
      valStr.includes('glasses_r') ||
      valStr.includes('right')
    ) {
      return 'Glasses Right';
    }
  }

  // Fallback: check if "ring" keyword is anywhere in the object values
  let hasRingString = false;
  function traverseRing(item: any) {
    if (hasRingString || item === null || item === undefined) return;
    if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          traverseRing(item[key]);
        }
      }
    } else if (typeof item === 'string') {
      if (item.toLowerCase().includes('ring')) {
        hasRingString = true;
      }
    }
  }
  traverseRing(event);
  
  if (hasRingString) {
    return 'Ring';
  }

  return 'Unknown';
}

function getEventTypeLabel(event: any): string {
  const typeVal = getRawEventType(event);
  if (typeVal === undefined) return 'undefined';
  
  const norm = OsEventTypeList.fromJson(typeVal);
  if (norm !== undefined) {
    return OsEventTypeList[norm] || String(typeVal);
  }
  return String(typeVal);
}

// Normalize Even G2 gestures
function parseG2Event(event: any): 'click' | 'double_click' | 'swipe_up' | 'swipe_down' | 'foreground_enter' | null {
  if (!event) return null;

  // Let's first check sysEvent.double_click as it is an explicit boolean flag
  if (event.sysEvent?.double_click === true) {
    return 'double_click';
  }

  const typeVal = getRawEventType(event);
  if (typeVal === undefined) {
    // Fallback: if sysEvent exists or source is Ring, treat as click
    if (event.sysEvent !== undefined || getEventSourceLabel(event) === 'Ring') {
      return 'click';
    }
    return null;
  }

  const valStr = String(typeVal).toLowerCase();

  // double_click: 3 or "DOUBLE_CLICK_EVENT" or "DOUBLE_CLICK"
  if (
    typeVal === 3 || 
    typeVal === '3' || 
    typeVal === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    valStr === 'double_click_event' || 
    valStr === 'double_click'
  ) {
    return 'double_click';
  }

  // swipe_up: 1 or "SCROLL_TOP_EVENT" or "SCROLL_TOP"
  if (
    typeVal === 1 || 
    typeVal === '1' || 
    typeVal === OsEventTypeList.SCROLL_TOP_EVENT ||
    valStr === 'scroll_top_event' || 
    valStr === 'scroll_top'
  ) {
    return 'swipe_up';
  }

  // swipe_down: 2 or "SCROLL_BOTTOM_EVENT" or "SCROLL_BOTTOM"
  if (
    typeVal === 2 || 
    typeVal === '2' || 
    typeVal === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
    valStr === 'scroll_bottom_event' || 
    valStr === 'scroll_bottom'
  ) {
    return 'swipe_down';
  }

  // click: 0 or "CLICK_EVENT" or "CLICK" or "RING_CLICK_EVENT" or "RING_CLICK"
  if (
    typeVal === 0 || 
    typeVal === '0' || 
    typeVal === OsEventTypeList.CLICK_EVENT ||
    valStr === 'click_event' || 
    valStr === 'click' || 
    valStr === 'ring_click_event' || 
    valStr === 'ring_click'
  ) {
    return 'click';
  }

  // foreground_enter: 4 or "FOREGROUND_ENTER_EVENT"
  if (
    typeVal === 4 ||
    typeVal === '4' ||
    valStr === 'foreground_enter_event' ||
    valStr === 'foreground_enter'
  ) {
    return 'foreground_enter';
  }

  return null;
}

// Function to update both G2 glasses display and local simulator
async function updateUI() {
  const text = app.getDisplayText();
  
  // Update browser simulator preview
  if (g2ContentEl) {
    g2ContentEl.textContent = text;
  }

  // Update diagnostic info panel
  if (stateScreenEl) stateScreenEl.textContent = app.getScreenState();
  
  const stats = getStorageData();
  const seenCount = Object.keys(stats).length;
  const wrongCount = getEverWrongWordIds().length;

  if (stateSeenEl) stateSeenEl.textContent = String(seenCount);
  if (stateWrongEl) stateWrongEl.textContent = String(wrongCount);

  // Send update to physical Even G2 glasses via SDK
  if (bridge) {
    try {
      const upgrade = new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: 2000,
        content: text
      });
      await bridge.textContainerUpgrade(upgrade);
    } catch (e) {
      console.warn('Failed upgrading text container using class, trying plain object fallback:', e);
      try {
        await bridge.textContainerUpgrade({
          containerID: 1,
          containerName: 'main',
          contentOffset: 0,
          contentLength: 2000,
          content: text
        } as any);
      } catch (innerErr) {
        console.error('Failed G2 text container update:', innerErr);
      }
    }
  }
}

// Attach SDK and App Lifecycle
async function start() {
  // Bind UI refresh callback
  app.bindStateChange(updateUI);

  // Load quiz data and initialize
  await app.init();
  updateUI();

  try {
    // Await G2 bridge connection
    bridge = await waitForEvenAppBridge();
    console.log('Even App Bridge initialized successfully!');

    // Initialize startup container layout on the glasses screen (576 x 288)
    const mainTextContainer = new TextContainerProperty({
      containerID: 1,
      containerName: 'main',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      content: app.getDisplayText(),
      isEventCapture: 1 // Required to capture gesture inputs
    });

    await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [mainTextContainer]
      })
    );

    // Listen for hardware interactions
    bridge.onEvenHubEvent((event: any) => {
      const gesture = parseG2Event(event);
      
      const typeLabel = getEventTypeLabel(event);
      const sourceLabel = getEventSourceLabel(event);
      
      // Update HTML diagnostic UI
      const stateLastEventEl = document.getElementById('state-last-event');
      if (stateLastEventEl) {
        stateLastEventEl.textContent = `Type: ${typeLabel} | Source: ${sourceLabel}`;
      }

      // Display raw event data on the screen
      const rawEventLogEl = document.getElementById('raw-event-log');
      if (rawEventLogEl) {
        rawEventLogEl.textContent = JSON.stringify(event, null, 2);
      }
      
      // Log details to console
      console.log('G2 Event Received - Gesture:', gesture, 'Type:', typeLabel, 'Source:', sourceLabel, 'Raw Event:', event);

      switch (gesture) {
        case 'swipe_up':
          app.handleSwipeUp();
          break;
        case 'swipe_down':
          app.handleSwipeDown();
          break;
        case 'click':
          app.handleClick();
          break;
        case 'double_click':
          app.handleDoubleClick();
          break;
        case 'foreground_enter':
          // Ignored for functional quiz actions
          console.log('Foreground enter event detected (ignored for quiz navigation).');
          break;
      }
    });

  } catch (e) {
    console.warn('Even Hub SDK failed to initialize (expected in standalone browser preview):', e);
  }
}

// --- Browser Simulation Event Listeners ---

// Keyboard controls
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      app.handleSwipeUp();
      break;
    case 'ArrowDown':
      e.preventDefault();
      app.handleSwipeDown();
      break;
    case 'Enter':
      e.preventDefault();
      app.handleClick();
      break;
    case 'Escape':
      e.preventDefault();
      app.handleDoubleClick();
      break;
  }
});

// Click handlers for Developer Console buttons
btnSwipeUp?.addEventListener('click', () => app.handleSwipeUp());
btnSwipeDown?.addEventListener('click', () => app.handleSwipeDown());
btnClick?.addEventListener('click', () => app.handleClick());
btnDoubleClick?.addEventListener('click', () => app.handleDoubleClick());

// Reset localStorage
btnResetStorage?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear your learning stats?')) {
    clearStorageData();
    updateUI();
  }
});

// Run application
start();
