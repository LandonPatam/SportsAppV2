import requests
from bs4 import BeautifulSoup
import json
import re

def get_country_code(flag_url):
    """Extract country code from flag image URL"""
    if not flag_url:
        return ""
    match = re.search(r'/([A-Z]{2})-', flag_url)
    return match.group(1) if match else ""

def get_fighter_name_from_link(link):
    """Extract fighter name from link text or href"""
    # Try getting text first
    name = link.get_text(strip=True)
    if name and len(name) > 2:
        return name
    
    # Try extracting from href
    href = link.get('href', '')
    if '/fightcenter/fighters/' in href:
        # Extract name from URL
        name_part = href.split('/')[-1]
        # Remove ID prefix if exists
        name_part = re.sub(r'^\d+-', '', name_part)
        # Convert hyphens to spaces and title case
        return name_part.replace('-', ' ').title()
    
    return ""

def scrape_fighter_profile(url):
    """Scrape individual fighter page for details."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        details = {}

        # Record (e.g. "22-6-0")
        record_tag = soup.find('span', class_='record')
        if record_tag:
            details['record'] = record_tag.get_text(strip=True)

        # Height / Reach / Weight Class
        for stat in soup.select('ul.list-unstyled li'):
            text = stat.get_text(strip=True)
            if 'Height:' in text:
                details['height'] = text.replace('Height:', '').strip()
            elif 'Reach:' in text:
                details['reach'] = text.replace('Reach:', '').strip()
            elif 'Weight Class:' in text:
                details['weight_class'] = text.replace('Weight Class:', '').strip()
            elif 'Gym:' in text:
                details['gym'] = text.replace('Gym:', '').strip()
            elif 'DOB:' in text:
                details['dob'] = text.replace('DOB:', '').strip()

        return details

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return {}


def scrape_ufc_rankings(url="https://www.tapology.com/rankings/ufc"):
    """
    Scrape UFC rankings from Tapology
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.content, 'html.parser')
    divisions = {}
    
    # Find all "View Division" links
    division_links = soup.find_all('a', href=re.compile(r'/rankings/ufc/ultimate-fighting-championship-'))
    
    for div_link in division_links:
        link_text = div_link.get_text(strip=True)
        
        # Skip if not a "View Division" link
        if not link_text.startswith('View Division'):
            continue
        
        # Extract total fighters count
        match = re.search(r'View Division \((\d+)\)', link_text)
        total_fighters = int(match.group(1)) if match else 0
        
        # Get division name from URL
        href = div_link.get('href', '')
        division_name_raw = href.split('/')[-1]
        division_name = (division_name_raw
                    .replace('ultimate-fighting-championship-', '')
                    .replace('mens-', "Mens ")
                    .replace('womens-', "Womens ")
                    .replace('-', ' ')
                    .title())

        
        # Find all previous siblings (fighters listed above this link)
        fighters = []
        seen_names = set()
        
        # Navigate backwards to collect fighter data
        current_elem = div_link
        
        # Look for up to 15 fighters (champion + top ranked)
        for _ in range(100):  # Iterate backwards through elements
            current_elem = current_elem.find_previous()
            
            if not current_elem:
                break
            
            # Stop if we hit another View Division link (previous division)
            if current_elem.name == 'a' and 'View Division' in current_elem.get_text(strip=True):
                break
            
            # Check for fighter headshot image (preview or tiny size)
            if current_elem.name == 'img':
                src = current_elem.get('src', '')
                
                # Look for headshot images
                if '/headshot_images/' in src:
                    # Find the associated fighter link
                    fighter_link = None
                    
                    # Check nearby siblings and parent for fighter link
                    parent = current_elem.find_parent()
                    if parent:
                        fighter_link = parent.find('a', href=re.compile(r'/fightcenter/fighters/'))
                    
                    if not fighter_link:
                        # Look in next few siblings
                        next_elem = current_elem.find_next()
                        for _ in range(5):
                            if not next_elem:
                                break
                            if next_elem.name == 'a' and '/fightcenter/fighters/' in next_elem.get('href', ''):
                                fighter_link = next_elem
                                break
                            next_elem = next_elem.find_next_sibling()
                    
                    # Extract fighter info
                    if fighter_link:
                        name = get_fighter_name_from_link(fighter_link)
                    else:
                        # Try alt text from image
                        name = current_elem.get('alt', '')
                    
                    if not name or name in seen_names or len(name) < 3:
                        continue
                    
                    seen_names.add(name)
                    
                    # Find flag for nationality
                    nationality = ""
                    flag_url = ""
                    flag_elem = current_elem.find_next('img', src=re.compile(r'/assets/flags/'))
                    if flag_elem:
                        flag_url = flag_elem.get('src', '')
                        nationality = get_country_code(flag_url)
                    
                    # Determine if champion (preview image = champion)
                    is_champion = 'preview' in src
                    
                    # Get full image URL
                    headshot_url = src if src.startswith('http') else f"https://images.tapology.com{src}" if not src.startswith('https://images.tapology.com') else src
                    flag_full_url = flag_url if flag_url.startswith('http') else f"https://www.tapology.com{flag_url}" if flag_url else ""
                    
                    fighters.append({
                        "name": name,
                        "nationality": nationality,
                        "champion": is_champion,
                        "url": f"https://www.tapology.com{fighter_link.get('href', '')}" if fighter_link else "",
                        "headshot_url": headshot_url,
                        "flag_url": flag_full_url
                    })
                    
                    # Limit to reasonable number
                    if len(fighters) >= 10:
                        break
        
        # Reverse to get correct order (we collected backwards)
        fighters = list(reversed(fighters))
        
        # Assign ranks
        for idx, fighter in enumerate(fighters, 1):
            fighter['rank'] = idx
        
        if fighters:
            divisions[division_name] = {
                "total_fighters": total_fighters,
                "top_ranked": fighters
            }
    
    return divisions


def main():
    """Main execution"""
    #print("Scraping UFC Rankings from Tapology...\n")
    
    try:
        rankings = scrape_ufc_rankings()
        
        if rankings:
            #print(f"✓ Found {len(rankings)} divisions:\n")
            
            for division, data in rankings.items():
                fighters = data.get('top_ranked', [])
                total = data.get('total_fighters', len(fighters))
                #print(f"\n{division} ({total} total fighters)")
                #print("-" * 60)
                
                for fighter in fighters:
                    champion_mark = " 🏆 CHAMPION" if fighter.get('champion') else ""
                    nat = f" ({fighter['nationality']})" if fighter['nationality'] else ""
                    #print(f"  {fighter['rank']:2d}. {fighter['name']}{nat}{champion_mark}")
            
            # Save to JSON
            out_path = r"D:\Personal Projects\SportsAppV2\src\ufc_rankings.json"
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(rankings, f, indent=2, ensure_ascii=False)
            
            #print(f"[OK] Rankings saved to {out_path}")
            print(f"[OK] UFC data up to date")
        else:
            print("❌ No divisions found. The page structure may have changed.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()