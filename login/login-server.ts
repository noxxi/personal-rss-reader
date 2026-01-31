import express, { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();

// Configuration file path (in the data directory, mounted as volume)
const configPath = process.env.LOGIN_CONFIG_PATH || '/app/data/login.json';

interface LoginConfigFile {
    username?: string;
    passwordHash: string;
    cookieSecret: string;
    cookieMaxAgeDays?: number;
}

interface Config {
    username: string;
    passwordHash: string;
    cookieSecret: string;
    cookieMaxAgeDays: number;
    port: number;
}

function loadConfig(): Config {
    if (!fs.existsSync(configPath)) {
        console.error(`ERROR: Configuration file not found: ${configPath}`);
        console.error('Please create a login.json file with the following structure:');
        console.error(JSON.stringify({
            username: 'admin',
            passwordHash: '<sha256-hash-of-password>',
            cookieSecret: '<64-char-hex-string>',
            cookieMaxAgeDays: 30
        }, null, 2));
        process.exit(1);
    }

    let fileConfig: LoginConfigFile;
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        fileConfig = JSON.parse(content);
    } catch (err) {
        console.error(`ERROR: Failed to parse configuration file: ${configPath}`);
        console.error(err);
        process.exit(1);
    }

    if (!fileConfig.passwordHash) {
        console.error('ERROR: passwordHash is required in login.json');
        process.exit(1);
    }
    if (!fileConfig.cookieSecret) {
        console.error('ERROR: cookieSecret is required in login.json');
        process.exit(1);
    }

    return {
        username: fileConfig.username || 'admin',
        passwordHash: fileConfig.passwordHash,
        cookieSecret: fileConfig.cookieSecret,
        cookieMaxAgeDays: fileConfig.cookieMaxAgeDays ?? 30,
        port: parseInt(process.env.LOGIN_PORT || '3001', 10)
    };
}

const config = loadConfig();

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: false }));

// Load login page template
const loginHtmlPath = path.join(__dirname, 'login.html');
const loginHtmlTemplate = fs.readFileSync(loginHtmlPath, 'utf-8');

function renderLoginPage(error?: string): string {
    const errorHtml = error
        ? `<div class="error">${escapeHtml(error)}</div>`
        : '';
    return loginHtmlTemplate.replace('{{ERROR}}', errorHtml);
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, c => map[c]);
}

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// GET /login - show login form
app.get('/login', (req: Request, res: Response) => {
    res.type('html').send(renderLoginPage());
});

// POST /login - process login
app.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.type('html').send(renderLoginPage('Username and password are required'));
        return;
    }

    const passwordHash = hashPassword(password);

    if (username === config.username && passwordHash === config.passwordHash) {
        // Set authentication cookie
        const maxAgeSeconds = config.cookieMaxAgeDays * 24 * 60 * 60;
        res.setHeader('Set-Cookie',
            `auth=${config.cookieSecret}; ` +
            `Path=/; ` +
            `HttpOnly; ` +
            `Secure; ` +
            `SameSite=Strict; ` +
            `Max-Age=${maxAgeSeconds}`
        );
        res.redirect('/');
    } else {
        res.type('html').send(renderLoginPage('Invalid username or password'));
    }
});

// GET /logout - clear cookie and redirect to login
app.get('/logout', (req: Request, res: Response) => {
    res.setHeader('Set-Cookie',
        'auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    );
    res.redirect('/login');
});

app.listen(config.port, () => {
    console.log(`Login server running on port ${config.port}`);
});
