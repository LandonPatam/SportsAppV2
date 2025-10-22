import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
import re

def extract_driver_code(driver_string):
    """Extract 3-letter driver code from driver string"""
    # Look for 3 uppercase letters at the end
    match = re.search(r'([A-Z]{3})$', driver_string)
    return match.group(1) if match else ""

def extract_driver_name(driver_string):
    """Extract driver name without code"""
    # Remove the 3-letter code at the end
    name = re.sub(r'[A-Z]{3}$', '', driver_string)
    return name.strip()

def scrape_f1_drivers(url, existing_json_path=None):
    """
    Scrape F1 driver standings from formula1.com
    
    Args:
        url: URL to the F1 drivers standings page
        existing_json_path: Path to existing JSON to preserve additional fields
    
    Returns:
        List of driver dictionaries matching your JSON format
    """
    # Load existing data if provided
    existing_data = {}
    if existing_json_path:
        try:
            with open(existing_json_path, 'r') as f:
                data = json.load(f)
                # Create lookup by driver code
                for driver in data:
                    if 'code' in driver:
                        existing_data[driver['code']] = driver
        except:
            pass
    
    # Set headers to mimic a browser request
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Fetch the page
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    # Parse HTML
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find the table
    table = soup.find('table')
    
    drivers = []
    
    if table:
        rows = table.find_all('tr')[1:]  # Skip header row
        
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 5:
                # Extract raw data
                position_str = cols[0].get_text(strip=True)
                driver_full = cols[1].get_text(strip=True)
                nationality = cols[2].get_text(strip=True)
                team = cols[3].get_text(strip=True)
                points_str = cols[4].get_text(strip=True)
                
                # Parse driver code and name
                code = extract_driver_code(driver_full)
                driver_name = extract_driver_name(driver_full)
                
                # Convert points to float
                try:
                    points = float(points_str)
                except:
                    points = 0.0
                
                # Convert position to int
                try:
                    position = int(position_str)
                except:
                    position = len(drivers) + 1
                
                # Check if we have existing data for this driver
                existing = existing_data.get(code, {})
                
                # Create driver data matching your format
                driver_data = {
                    "position": position,
                    "code": code,
                    "driver": driver_name,
                    "team": team,
                    "nationality": nationality,
                    "points": points,
                    "wins": existing.get("wins", 0),
                    "podiums": existing.get("podiums", 0),
                    "podium_pct": existing.get("podium_pct", 0.0)
                }
                
                drivers.append(driver_data)
    
    return drivers


def scrape_with_selenium(url, existing_json_path=None):
    """
    Alternative method using Selenium for JavaScript-heavy pages
    Requires: pip install selenium
    """
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    
    # Load existing data if provided
    existing_data = {}
    if existing_json_path:
        try:
            with open(existing_json_path, 'r') as f:
                data = json.load(f)
                for driver in data:
                    if 'code' in driver:
                        existing_data[driver['code']] = driver
        except:
            pass
    
    # Setup Chrome driver
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    
    try:
        driver.get(url)
        
        # Wait for table to load
        wait = WebDriverWait(driver, 10)
        table = wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
        
        # Extract data
        rows = driver.find_elements(By.CSS_SELECTOR, "table tr")[1:]
        
        drivers = []
        for row in rows:
            cols = row.find_elements(By.TAG_NAME, "td")
            if len(cols) >= 5:
                position_str = cols[0].text
                driver_full = cols[1].text
                nationality = cols[2].text
                team = cols[3].text
                points_str = cols[4].text
                
                code = extract_driver_code(driver_full)
                driver_name = extract_driver_name(driver_full)
                
                try:
                    points = float(points_str)
                except:
                    points = 0.0
                
                try:
                    position = int(position_str)
                except:
                    position = len(drivers) + 1
                
                existing = existing_data.get(code, {})
                
                driver_data = {
                    "position": position,
                    "code": code,
                    "driver": driver_name,
                    "team": team,
                    "nationality": nationality,
                    "points": points,
                    "wins": existing.get("wins", 0),
                    "podiums": existing.get("podiums", 0),
                    "podium_pct": existing.get("podium_pct", 0.0)
                }
                
                drivers.append(driver_data)
        
        return drivers
    
    finally:
        driver.quit()


# Main execution
if __name__ == "__main__":
    url = "https://www.formula1.com/en/results/2025/drivers"
    existing_json = "f1_drivers_2025.json"  # Path to your existing JSON
    
    # Method 1: Using requests + BeautifulSoup
    try:
        print("Scraping F1 Driver Standings...")
        drivers = scrape_f1_drivers(url, existing_json)
        
        # Display as DataFrame for preview
        df = pd.DataFrame(drivers)
        print("\nDriver Standings:")
        print(df)
        
        # Save to JSON in your format
        with open('f1_drivers_2025_updated.json', 'w') as f:
            json.dump(drivers, f, indent=2)
        
        print("\nData saved to f1_drivers_2025_updated.json")
        
        # Also save to CSV if needed
        df.to_csv('f1_drivers_2025.csv', index=False)
        print("Data saved to f1_drivers_2025.csv")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nIf BeautifulSoup method fails, try the Selenium method.")
        print("Install with: pip install selenium")