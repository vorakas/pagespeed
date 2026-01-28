import sqlite3
import psycopg2
import psycopg2.extras
from datetime import datetime
import json
import os

class Database:
    def __init__(self, db_url=None):
        # Check for DATABASE_URL (PostgreSQL on Railway)
        self.db_url = db_url or os.getenv('DATABASE_URL')
        self.is_postgres = self.db_url is not None
        
        # For SQLite (local development)
        if not self.is_postgres:
            self.db_path = 'pagespeed.db'
        
        self.init_db()
    
    def get_connection(self):
        if self.is_postgres:
            conn = psycopg2.connect(self.db_url)
            return conn
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
    
    def init_db(self):
        """Initialize database tables"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.is_postgres:
            # PostgreSQL schema
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sites (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS urls (
                    id SERIAL PRIMARY KEY,
                    site_id INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (site_id) REFERENCES sites (id),
                    UNIQUE(site_id, url)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS test_results (
                    id SERIAL PRIMARY KEY,
                    url_id INTEGER NOT NULL,
                    performance_score REAL,
                    accessibility_score REAL,
                    best_practices_score REAL,
                    seo_score REAL,
                    fcp REAL,
                    lcp REAL,
                    cls REAL,
                    tti REAL,
                    tbt REAL,
                    speed_index REAL,
                    raw_data TEXT,
                    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (url_id) REFERENCES urls (id)
                )
            ''')
        else:
            # SQLite schema
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS urls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    site_id INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (site_id) REFERENCES sites (id),
                    UNIQUE(site_id, url)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS test_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url_id INTEGER NOT NULL,
                    performance_score REAL,
                    accessibility_score REAL,
                    best_practices_score REAL,
                    seo_score REAL,
                    fcp REAL,
                    lcp REAL,
                    cls REAL,
                    tti REAL,
                    tbt REAL,
                    speed_index REAL,
                    raw_data TEXT,
                    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (url_id) REFERENCES urls (id)
                )
            ''')
        
        conn.commit()
        conn.close()
    
    def add_site(self, name):
        """Add a new site"""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO sites (name) VALUES (%s)' if self.is_postgres else 'INSERT INTO sites (name) VALUES (?)', (name,))
            conn.commit()
            site_id = cursor.lastrowid if not self.is_postgres else cursor.fetchone()[0] if cursor.rowcount == 0 else None
            if self.is_postgres and site_id is None:
                cursor.execute('SELECT lastval()')
                site_id = cursor.fetchone()[0]
            conn.close()
            return site_id
        except (sqlite3.IntegrityError if not self.is_postgres else psycopg2.IntegrityError):
            conn.close()
            return None
    
    def add_url(self, site_id, url):
        """Add a URL to a site"""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO urls (site_id, url) VALUES (%s, %s)' if self.is_postgres else 'INSERT INTO urls (site_id, url) VALUES (?, ?)', (site_id, url))
            conn.commit()
            url_id = cursor.lastrowid if not self.is_postgres else None
            if self.is_postgres:
                cursor.execute('SELECT lastval()')
                url_id = cursor.fetchone()[0]
            conn.close()
            return url_id
        except (sqlite3.IntegrityError if not self.is_postgres else psycopg2.IntegrityError):
            conn.close()
            return None
    
    def get_sites(self):
        """Get all sites"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sites ORDER BY name')
        if self.is_postgres:
            sites = []
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                sites.append(dict(zip(columns, row)))
        else:
            sites = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return sites
    
    def get_urls_by_site(self, site_id):
        """Get all URLs for a specific site"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM urls WHERE site_id = %s ORDER BY url' if self.is_postgres else 'SELECT * FROM urls WHERE site_id = ? ORDER BY url', (site_id,))
        if self.is_postgres:
            urls = []
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                urls.append(dict(zip(columns, row)))
        else:
            urls = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return urls
    
    def save_test_result(self, url_id, result_data):
        """Save a test result"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO test_results (
                url_id, performance_score, accessibility_score, 
                best_practices_score, seo_score, fcp, lcp, cls, 
                tti, tbt, speed_index, raw_data
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''' if self.is_postgres else '''
            INSERT INTO test_results (
                url_id, performance_score, accessibility_score, 
                best_practices_score, seo_score, fcp, lcp, cls, 
                tti, tbt, speed_index, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        cursor.execute(query, (
            url_id,
            result_data.get('performance_score'),
            result_data.get('accessibility_score'),
            result_data.get('best_practices_score'),
            result_data.get('seo_score'),
            result_data.get('fcp'),
            result_data.get('lcp'),
            result_data.get('cls'),
            result_data.get('tti'),
            result_data.get('tbt'),
            result_data.get('speed_index'),
            json.dumps(result_data.get('raw_data', {}))
        ))
        
        conn.commit()
        result_id = cursor.lastrowid if not self.is_postgres else None
        if self.is_postgres:
            cursor.execute('SELECT lastval()')
            result_id = cursor.fetchone()[0]
        conn.close()
        return result_id
    
    def get_latest_results(self, site_id):
        """Get the latest test results for all URLs in a site"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                u.id as url_id,
                u.url,
                tr.performance_score,
                tr.accessibility_score,
                tr.best_practices_score,
                tr.seo_score,
                tr.fcp,
                tr.lcp,
                tr.cls,
                tr.tested_at
            FROM urls u
            LEFT JOIN (
                SELECT url_id, MAX(tested_at) as max_date
                FROM test_results
                GROUP BY url_id
            ) latest ON u.id = latest.url_id
            LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
            WHERE u.site_id = %s
            ORDER BY u.url
        ''' if self.is_postgres else '''
            SELECT 
                u.id as url_id,
                u.url,
                tr.performance_score,
                tr.accessibility_score,
                tr.best_practices_score,
                tr.seo_score,
                tr.fcp,
                tr.lcp,
                tr.cls,
                tr.tested_at
            FROM urls u
            LEFT JOIN (
                SELECT url_id, MAX(tested_at) as max_date
                FROM test_results
                GROUP BY url_id
            ) latest ON u.id = latest.url_id
            LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
            WHERE u.site_id = ?
            ORDER BY u.url
        '''
        
        cursor.execute(query, (site_id,))
        
        if self.is_postgres:
            results = []
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
        else:
            results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_historical_data(self, url_id, days=30):
        """Get historical test data for a URL"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                performance_score,
                accessibility_score,
                best_practices_score,
                seo_score,
                fcp,
                lcp,
                cls,
                tested_at
            FROM test_results
            WHERE url_id = %s
            AND tested_at >= NOW() - INTERVAL '%s days'
            ORDER BY tested_at ASC
        ''' if self.is_postgres else '''
            SELECT 
                performance_score,
                accessibility_score,
                best_practices_score,
                seo_score,
                fcp,
                lcp,
                cls,
                tested_at
            FROM test_results
            WHERE url_id = ?
            AND tested_at >= datetime('now', '-' || ? || ' days')
            ORDER BY tested_at ASC
        '''
        
        cursor.execute(query, (url_id, days))
        
        if self.is_postgres:
            results = []
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
        else:
            results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_all_urls(self):
        """Get all URLs with their site information"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT u.id, u.url, s.name as site_name, s.id as site_id
            FROM urls u
            JOIN sites s ON u.site_id = s.id
            ORDER BY s.name, u.url
        ''')
        
        if self.is_postgres:
            results = []
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
        else:
            results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
