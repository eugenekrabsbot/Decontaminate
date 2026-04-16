const https = require('https');
const url = 'https://calendar.google.com/calendar/ical/wrt9510%40gmail.com/private-321552b3676e28e805b4e4282e09ead7/basic.ics';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        parseICal(data);
    });
}).on('error', (err) => {
    console.error('Fetch error:', err);
});

function parseICal(ical) {
    const lines = ical.split(/\r?\n/);
    const events = [];
    let inEvent = false;
    let current = {};
    
    for (let line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            current = {};
            continue;
        }
        if (line.startsWith('END:VEVENT')) {
            inEvent = false;
            if (current.summary && current.start) {
                events.push({...current});
            }
            continue;
        }
        if (!inEvent) continue;
        
        const match = line.match(/^([^:]+):(.+)$/);
        if (!match) continue;
        const key = match[1];
        const value = match[2];
        
        if (key === 'SUMMARY') current.summary = value;
        else if (key === 'DTSTART') current.start = parseICalDate(value);
        else if (key === 'DTEND') current.end = parseICalDate(value);
        else if (key === 'DESCRIPTION') current.description = value;
    }
    
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const upcoming = events.filter(ev => ev.start >= now && ev.start <= sevenDaysFromNow);
    upcoming.sort((a, b) => a.start - b.start);
    
    console.log(`Total events in feed: ${events.length}`);
    console.log(`Upcoming events (next 7 days): ${upcoming.length}`);
    
    if (upcoming.length > 0) {
        console.log('\nUpcoming events:');
        upcoming.forEach(ev => {
            const date = ev.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
            console.log(`- ${date}: ${ev.summary}`);
        });
    } else {
        console.log('No events in the next 7 days.');
    }
}

function parseICalDate(str) {
    // Handle iCal date format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    if (str.length === 15 && str.endsWith('Z')) {
        // UTC
        const year = str.substr(0,4);
        const month = str.substr(4,2);
        const day = str.substr(6,2);
        const hour = str.substr(9,2);
        const minute = str.substr(11,2);
        const second = str.substr(13,2);
        return new Date(Date.UTC(year, month-1, day, hour, minute, second));
    } else if (str.length === 8) {
        // Date only
        const year = str.substr(0,4);
        const month = str.substr(4,2);
        const day = str.substr(6,2);
        return new Date(year, month-1, day);
    } else {
        // Try generic
        return new Date(str);
    }
}