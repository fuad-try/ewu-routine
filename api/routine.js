// api/routine.js
import { JSDOM } from 'jsdom'; // For parsing HTML (equivalent to DOMDocument in PHP)

// Using node-fetch for making HTTP requests, as it's closer to browser's fetch API
// and widely used in Node.js.
// You'll need to install it: npm install node-fetch@2 (for CommonJS support, as Vercel
// often uses older Node.js runtimes for serverless functions, though recent ones support ESM)
// If you're on Node.js 18+ and using ES Modules, you can use: import fetch from 'node-fetch';
// For Vercel, typically fetch is globally available or you need to install a specific version
// that is compatible with CommonJS if you're not using ESM.
// For Vercel deployments, 'node-fetch' v2 is usually a safe bet for CommonJS.
import fetch from 'node-fetch';

// --- User Configuration ---
const PORTAL_URL = 'https://portal.ewubd.edu/';
const PROFILE_API_URL = 'https://portal.ewubd.edu/api/Advising/GetSemesterStudentWiseAdvisingCourseListStudent/137';

// Day mapping for routine
const DAY_MAP = {
    'M': 'MONDAY',
    'S': 'SUNDAY',
    'W': 'WEDNESDAY',
    'T': 'TUESDAY',
    'R': 'THURSDAY',
    'F': 'FRIDAY',
    'U': 'SUNDAY'
};

export default async function handler(req, res) {
    // Set CORS headers for Vercel deployment if your frontend is on a different origin
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this in production!
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed. Only GET is supported.' });
    }

    // --- SECURE CREDENTIAL HANDLING ---
    // For a production web application, credentials should NOT come from GET parameters.
    // Use POST requests for login or implement a token-based authentication system.
    const { username, password } = req.query;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Missing Credentials',
            message: 'Please provide both "username" and "password" as GET query parameters.'
        });
    }

    let cookieString = '';
    let calculatedAnswer = null;
    let num1 = null;
    let num2 = null;

    // --- Step 1: Perform GET request to get captcha and session cookies ---
    try {
        const getResponse = await fetch(PORTAL_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Cache-Control': 'max-age=0',
                'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'save-data': 'on',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
            }
        });

        if (!getResponse.ok) {
            console.error(`Initial GET Request Failed: ${getResponse.status} ${getResponse.statusText}`);
            return res.status(500).json({ error: 'Initial GET Request Failed', message: 'Failed to connect to the portal. Please try again later.' });
        }

        // Extract cookies
        const setCookieHeaders = getResponse.headers.raw()['set-cookie'];
        if (setCookieHeaders) {
            cookieString = setCookieHeaders
                .map(cookie => cookie.split(';')[0].trim())
                .join('; ');
        }

        const htmlBodyGet = await getResponse.text();

        // Parse HTML to extract captcha numbers
        const dom = new JSDOM(htmlBodyGet);
        const document = dom.window.document;

        const firstNoElement = document.getElementById('lblFirstNo');
        const operatorElement = document.getElementById('lblplus');
        const secondNoElement = document.getElementById('lblSecondNo');

        num1 = firstNoElement ? parseInt(firstNoElement.textContent.trim()) : null;
        const op = operatorElement ? operatorElement.textContent.trim() : '+';
        num2 = secondNoElement ? parseInt(secondNoElement.textContent.trim()) : null;

        if (num1 !== null && num2 !== null) {
            switch (op) {
                case '+':
                    calculatedAnswer = num1 + num2;
                    break;
                case '-':
                    calculatedAnswer = num1 - num2;
                    break;
                default:
                    return res.status(500).json({ error: 'Captcha Operator Not Supported', message: 'An unexpected captcha format was encountered.' });
            }
        } else {
            return res.status(500).json({ error: 'Could Not Extract Captcha Numbers', message: 'Failed to parse the captcha. The portal\'s structure might have changed.' });
        }

        if (calculatedAnswer === null || !cookieString) {
            return res.status(500).json({ error: 'Failed to prepare login data.', message: 'Could not gather all necessary information for login.' });
        }

    } catch (error) {
        console.error('Error during initial GET request or captcha parsing:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'Failed during initial portal access or captcha resolution.' });
    }

    // --- Step 2: Perform POST request for login ---
    let dashboardHtmlResponse = '';
    let loginSuccess = false;
    try {
        const postData = new URLSearchParams({
            'Username': username,
            'Password': password,
            'Answer': calculatedAnswer,
            'FirstNo': num1,
            'SecondNo': num2,
        }).toString();

        const postResponse = await fetch(PORTAL_URL, {
            method: 'POST',
            headers: {
                'Host': 'portal.ewubd.edu',
                'Connection': 'keep-alive',
                'Content-Length': postData.length.toString(),
                'Cache-Control': 'max-age=0',
                'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'save-data': 'on',
                'Origin': 'https://portal.ewubd.edu',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'Referer': 'https://portal.ewubd.edu/',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
                'Cookie': cookieString
            },
            body: postData,
            redirect: 'follow' // Automatically follow redirects
        });

        // After a successful login POST, the portal usually redirects.
        // The final URL after redirects can indicate success/failure.
        // A simple check is to see if the response URL is still the portal_url,
        // or if it redirected to the dashboard.
        // A more robust check would involve parsing the HTML for specific elements
        // indicating successful login or an error message.
        if (postResponse.url.includes('Home/Dashboard')) { // Check for common dashboard URL part
             loginSuccess = true;
        } else {
            // Check if there's a login error message in the response body
            const loginResponseBody = await postResponse.text();
            if (loginResponseBody.includes('Invalid User Name or Password')) {
                return res.status(401).json({ error: 'Login Failed', message: 'Invalid User Name or Password.' });
            }
            // Add other error checks if known
            console.error('Login did not redirect to dashboard as expected. Final URL:', postResponse.url);
            return res.status(401).json({ error: 'Login Failed', message: 'An error occurred during login. Check credentials or portal status.' });
        }


    } catch (error) {
        console.error('Error during login POST request:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred during the login attempt.' });
    }

    if (!loginSuccess) {
        return res.status(401).json({ error: 'Login Failed', message: 'Could not confirm successful login.' });
    }

    // --- Step 3: Access the Student Advising Course List API ---
    let profileApiResponse;
    try {
        const apiResponse = await fetch(PROFILE_API_URL, {
            headers: {
                'Host': 'portal.ewubd.edu',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest',
                'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'Origin': 'https://portal.ewubd.edu',
                'Referer': 'https://portal.ewubd.edu/Advising/AdvisingList',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
                'Cookie': cookieString // IMPORTANT: Reuse the session cookies
            }
        });

        if (!apiResponse.ok) {
            console.error(`Advising API Request Failed: ${apiResponse.status} ${apiResponse.statusText}`);
            return res.status(apiResponse.status).json({ error: 'Failed to fetch Advising Course List API data', message: apiResponse.statusText });
        }

        profileApiResponse = await apiResponse.json();

    } catch (error) {
        console.error('Error fetching Advising API data:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch advising course list data.' });
    }

    // --- Process the API Response into a structured routine object ---
    const routineData = {
        "SUNDAY": [],
        "MONDAY": [],
        "TUESDAY": [],
        "WEDNESDAY": [],
        "THURSDAY": [],
        "FRIDAY": [],
        "SATURDAY": []
    };

    if (Array.isArray(profileApiResponse)) {
        profileApiResponse.forEach(course => {
            const timeSlotName = course.TimeSlotName;

            // Extract the day codes (e.g., "MW", "TR", "S")
            const dayCodeMatch = timeSlotName.match(/^([A-Z]+)\s/);
            const dayCodes = dayCodeMatch ? dayCodeMatch[1] : '';

            // Extract the time (e.g., "1:30PM-3:00PM")
            const time = timeSlotName.replace(/^[A-Z]+\s/, '');

            // Determine CourseType (Theory or Lab)
            const courseType = course.CourseCode.toLowerCase().includes('lab') ? 'Lab' : 'Theory';

            // Process each day code if multiple days are present (e.g., MW, TR)
            const individualDayCodes = dayCodes.split('');

            individualDayCodes.forEach(dayCode => {
                if (DAY_MAP[dayCode]) {
                    const fullDayName = DAY_MAP[dayCode];

                    const courseDetails = {
                        CourseCode: course.CourseCode,
                        CourseType: courseType,
                        Section: course.SectionName,
                        Faculty: course.FacultyName,
                        ShortName: course.ShortName,
                        Email: course.Email,
                        Time: time,
                        Room: course.RoomName
                    };
                    routineData[fullDayName].push(courseDetails);
                }
            });
        });
    }

    // Sort classes within each day by time
    Object.keys(routineData).forEach(day => {
        routineData[day].sort((a, b) => {
            // Simple time comparison, assuming 'HH:MMPM-HH:MMPM' format.
            // For robust time sorting (e.g., handling AM/PM correctly),
            // you might need a dedicated time parsing library or more complex logic.
            const timeA = a.Time.split('-')[0];
            const timeB = b.Time.split('-')[0];

            // Convert to a comparable format (e.g., 24-hour, or total minutes from midnight)
            // This is a basic approach and might need refinement for all edge cases (e.g., 12 AM/PM).
            const parseTime = (timeStr) => {
                const [time, period] = timeStr.match(/(\d{1,2}:\d{2})(AM|PM)/i).slice(1);
                let [hours, minutes] = time.split(':').map(Number);
                if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
                if (period.toLowerCase() === 'am' && hours === 12) hours = 0; // Midnight
                return hours * 60 + minutes;
            };

            try {
                const minutesA = parseTime(timeA);
                const minutesB = parseTime(timeB);
                return minutesA - minutesB;
            } catch (e) {
                console.warn('Error parsing time for sorting:', e);
                return 0; // Fallback to no sorting if parsing fails
            }
        });
    });


    // Send the processed routine data as JSON
    res.status(200).json(routineData);
}
