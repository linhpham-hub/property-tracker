-- ============================================================
-- One-time batch fill: Tag list, Welcome note 1/2/3, and Notes
-- pulled directly from your Excel file's Property_master tab,
-- with original line breaks preserved (so Welcome notes still
-- paste into WhatsApp with proper line breaks, not one block).
--
-- Only updates properties that currently have a BLANK value for
-- that specific field, so anything you've already typed manually
-- in the app is left untouched. Matched by property_name.
--
-- Covers 32 properties that had at least one of these
-- fields filled in in your spreadsheet. Everything else stays
-- blank for you to fill in manually, as you asked.
-- ============================================================

-- 11 Amber Road_1
update properties set
  tag_list = case when tag_list is null or tag_list = '' then '11 Amber / Patty' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

2 Units For SALE at 11 AMBER! 
✅ Marine Parade, District 15
✅ Freehold
✅ TOP 2004
✅ 40 Units
✅ 3 Bed 3 Bath, with yard, household shelter, balcony, planters, living and dining areas
✅ 1,496 sqft
✅ MCST Fee $1,680 per Quarter (3 Months) - management plus sinking

Unit 1 Virtual Tour: https://my.matterport.com/show/?m=4nUHCiqU184
Unit 1 PropertyGuru: https://www.propertyguru.com.sg/listing/for-sale-11-amber-road-60043268
Unit 1: Owner Stay

Unit 2 Virtual Tour: https://my.matterport.com/show/?m=3AoEBu8ESeo
Unit 2 PropertyGuru: https://www.propertyguru.com.sg/listing/for-sale-11-amber-road-500153780
Unit 2: Tenanted till 7 August 2028 at $6300 (can break lease from 8 August 2027)

Javier 
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = '11 Amber Road_1';

-- 11 Amber Road_2
update properties set
  tag_list = case when tag_list is null or tag_list = '' then '11 Amber / Patty' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

2 Units For SALE at 11 AMBER! 
✅ Marine Parade, District 15
✅ Freehold
✅ TOP 2004
✅ 40 Units
✅ 3 Bed 3 Bath, with yard, household shelter, balcony, planters, living and dining areas
✅ 1,496 sqft
✅ MCST Fee $1,680 per Quarter (3 Months) - management plus sinking

Unit 1 Virtual Tour: https://my.matterport.com/show/?m=4nUHCiqU184
Unit 1 PropertyGuru: https://www.propertyguru.com.sg/listing/for-sale-11-amber-road-60043268
Unit 1: Owner Stay

Unit 2 Virtual Tour: https://my.matterport.com/show/?m=3AoEBu8ESeo
Unit 2 PropertyGuru: https://www.propertyguru.com.sg/listing/for-sale-11-amber-road-500153780
Unit 2: Tenanted till 7 August 2028 at $6300 (can break lease from 8 August 2027)

Javier 
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = '11 Amber Road_2';

-- 11 Amber Road_3
update properties set
  tag_list = case when tag_list is null or tag_list = '' then '11 Amber / Patty' else tag_list end
where property_name = '11 Amber Road_3';

-- 184 Woodlands Industrial Park E5
update properties set
  tag_list = case when tag_list is null or tag_list = '' then '??' else tag_list end
where property_name = '184 Woodlands Industrial Park E5';

-- 193 Bukit Batok West Avenue 6
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Room Rentals' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end
where property_name = '193 Bukit Batok West Avenue 6';

-- 205 Choa Chu Kang Central
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Jeena / Clarence / Geogre' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your inquiry for 205 Choa Chu Kang Central

Flat Information
✅4 Bedroom 2 Bath, with Spacious Living & Dining Areas, Store, and Kitchen
✅Squarish and Functional Layout, Spacious rooms
✅Bright and Windy Unit, Quiet Facing
✅Corner Flat
✅High Floor
✅Require Extension of Stay

Virtual Tour: https://my.matterport.com/show/?m=DEwPHPfvFF5

Let me know if the above match your requirements.
Javier
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any flats here before?
-Do you/buyer need to sell your current house first before buying?
-Have you/buyer done HFE already?' else welcome_note_2 end,
  welcome_note_3 = case when welcome_note_3 is null or welcome_note_3 = '' then 'May I confirm what’s your ethnic group? To check ethnic quota' else welcome_note_3 end
where property_name = '205 Choa Chu Kang Central';

-- 327C Anchorvale Road
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Room Rentals' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end
where property_name = '327C Anchorvale Road';

-- 502 Hougang Avenue 8_1
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Joe / Sharena / Brownstone' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end,
  notes = case when notes is null or notes = '' then 'common room, 2 pax' else notes end
where property_name = '502 Hougang Avenue 8_1';

-- 591 Serangoon Road, City & South West
update properties set
  tag_list = case when tag_list is null or tag_list = '' then '??' else tag_list end
where property_name = '591 Serangoon Road, City & South West';

-- 63@Ubi
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Ubi Indus / Faith / Ivan' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello, yes it’s available
Most of the usable space is on the mezzanine level, is that okay?
What’s your business trade, rental term and rental start date?' else welcome_note_1 end
where property_name = '63@Ubi';

-- 749 Geylang Road
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Important Chats (Previous Cases)' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available. What’s your business trade, rental term and rental start date?' else welcome_note_1 end
where property_name = '749 Geylang Road';

-- Atrium Residences
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Kai / CeWei / Ai Lay' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your enquiry for Atrium Residences

Unit information
✅ 2 Bedroom 2 Bath
✅ 1,830 sqft
✅ Duplex / 2-level Penthouse
✅ Spacious living and dining areas (Functional layout)
✅ TOP 2008, Freehold
✅ Sold Vacant Possession (Need Extension of Stay)
✅ Est. MCST Fee about $469.20 Monthly

Virtual tour: https://my.matterport.com/show/?m=sCq8u9ETG7q

Let me know if the above match your requirements. 
Javier 
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any units here before?
-Do you/buyer need to sell your current house first before buying?
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'Atrium Residences';

-- Bizlink Centre
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Steve / Novelty / OWN' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available. What’s your business trade, rental term and rental start date?' else welcome_note_1 end,
  notes = case when notes is null or notes = '' then 'toilet outside' else notes end
where property_name = 'Bizlink Centre';

-- Carros Centre_5
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Victor / Kate / Nur Carros' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available
What’s your business trade, rental term, and rental start date?' else welcome_note_1 end
where property_name = 'Carros Centre_5';

-- Centro Residences_1
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Lee Roy / Roy / Centro' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello yes it’s available
Unit come with big patio is that okay?' else welcome_note_1 end
where property_name = 'Centro Residences_1';

-- Eunos Techpark_2
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Landlord / UB Point / LSJ' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'What’s tenant trade, rental term and rental start date?
What’s your rental term and rental start date?' else welcome_note_1 end
where property_name = 'Eunos Techpark_2';

-- Junction Nine
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Leeroy / Roy / Centro' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your enquiry for Junction Nine

Unit information
✅ 99 Years Lease from 2013
✅ 710 sqft
✅ $10,000 + GST till February 2028 to Chinese food Tenant
✅ Ground Floor Unit
✅ GST Unit
✅ Property tax for 2026 is $11,615 per annum
✅ Maintenance fees is about $3,821.24 per 3 months

Let me know if the above match your requirements. 
Javier
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end,
  notes = case when notes is null or notes = '' then 'Ground floor' else notes end
where property_name = 'Junction Nine';

-- Kovan City
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Ubi Indus / Faith / Ivan' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, what’s your business trade, rental term and rental start date?
This on second floor is that okay?' else welcome_note_1 end
where property_name = 'Kovan City';

-- Parc Riviera
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Raymond / Asmine' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your enquiry for Parc Riviera

Unit information
✅ 1 Bedroom 1 Bath
✅ 463 sqft
✅ Squarish and Functional Layout. Well-kept, Move-In Condition.
✅ Mid Floor
✅ TOP 2019, Tenure 99 Years
✅ Tenanted till 28th June 2027 at $3,400
✅ Est. MCST Fee about $752.10 inclusive GST per Quarter (3 Months)

Virtual Tour: https://my.matterport.com/show/?m=En5sjFeRCeW

Let me know if the above match your requirements. 
Javier 
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any units here before?
-Do you/buyer need to sell your current house first before buying?
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'Parc Riviera';

-- Piccadilly Grand
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Leeroy / Roy / Centro' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your enquiry for Piccadilly Grand

Unit information
✅ 4 Beds 4 Baths Dual-Key Unit
✅ 1,389 sqft
✅ Pool View
✅ Mid Floor
✅ MCST about $472 per month including GST
✅ TOP 2026, 99 Years from 2021
✅ Not tenanted

Let me know if the above match your requirements. 
Javier from Crestbrick😊' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'Piccadilly Grand';

-- Queens Peak
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Wanni / REVV / Lilium' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for your interest for Queens Peak 1Bedroom 

Unit information
✅ 441 sqft
✅$810.31/qtr
(2 same unit type available, 11th floor and 13th floor)
✅ Tenanted $3.3k till Oct 2027 (11th floor)
✅ Tenanted $3.4K till June 2026 (13th floor)

Let me know if the above match your requirements. Javier from Crestbrick😊' else welcome_note_1 end
where property_name = 'Queens Peak';

-- Suites At Orchard_3
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Leeroy / Roy / Centro' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end
where property_name = 'Suites At Orchard_3';

-- The Lilium
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Wanni / REVV / Lilium' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

Thank you for your enquiry for The Lilium

Unit information
✅ 2 Bedroom 2 Bath
✅ 700 sqft
✅ Efficient and Regular Layout. Well-kept, Move-In Condition.
✅ Mid Floor, Pool Facing
✅ MCST about ~$354 per month (Management fees ~$324, sinking fund ~$30)
✅ TOP 2021, Tenure FREEHOLD
✅ Tenanted till 31st December 2026 at Rental $3,800

VIRTUAL TOUR
https://my.matterport.com/show/?m=59dHxkSuVPZ

Let me know if the above match your requirements. 
Javier 
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'The Lilium';

-- WCEGA Plaza
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Landlord / UB Point / LSJ' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available
What’s your business trade, rental term and rental start date?' else welcome_note_1 end,
  notes = case when notes is null or notes = '' then 'no sharing unit' else notes end
where property_name = 'WCEGA Plaza';

-- Wcega Tower
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Wcega / Helene / AMK / Jake' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

2 Units For SALE at Wcega Tower
✅ 60 Years from 1997

Unit 1: https://www.commercialguru.com.sg/listing/for-sale-wcega-tower-25508104
✅ 969 sqft
✅ Vacant (Owner-Use)
✅ MCST (approx.): $939.47 per 3 Months
✅ Property Tax (approx.): $270 per Month
✅ No GST Unit
✅ Flatted Industrial Unit

Unit 2: https://www.commercialguru.com.sg/listing/for-sale-wcega-tower-500208595
✅ 958 sqft
✅ Tenanted until 14 Sep 2026
✅ MCST (approx.): $297.60 each Month
✅ Property Tax (approx.): $210 per Month
✅ No GST Unit
✅ Flatted Industrial Unit

Let me know if the above match your requirements. 
Javier
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'Wcega Tower';

-- Westwood Residences EC
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Shu Feng / Jeanette' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end,
  notes = case when notes is null or notes = '' then 'no coliving' else notes end
where property_name = 'Westwood Residences EC';

-- The Interlace
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Ubi indus / Faith / Ivan' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end
where property_name = 'The Interlace';

-- The Brownstone
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Joe / Sharena / Brownstone' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Thank you for the enquiry. Kindly please fill in the following where applicable. 

Profile: 
Type of pass:
Nationality: 
How many Pax Staying: 
Occupation:
Rental Start date: 
Rental Lease Period:
Budget: 
Furniture Requests:
Any requirement(s):

Javier
Crestbrick' else welcome_note_1 end
where property_name = 'The Brownstone';

-- Wcega Tower_2
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Wcega / Helene / AMK / Jake' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hello! :)

2 Units For SALE at Wcega Tower
✅ 60 Years from 1997

Unit 1: https://www.commercialguru.com.sg/listing/for-sale-wcega-tower-25508104
✅ 969 sqft
✅ Vacant (Owner-Use)
✅ MCST (approx.): $939.47 per 3 Months
✅ Property Tax (approx.): $270 per Month
✅ No GST Unit
✅ Flatted Industrial Unit

Unit 2: https://www.commercialguru.com.sg/listing/for-sale-wcega-tower-500208595
✅ 958 sqft
✅ Tenanted until 14 Sep 2026
✅ MCST (approx.): $297.60 each Month
✅ Property Tax (approx.): $210 per Month
✅ No GST Unit
✅ Flatted Industrial Unit

Let me know if the above match your requirements. 
Javier
Crestbrick' else welcome_note_1 end,
  welcome_note_2 = case when welcome_note_2 is null or welcome_note_2 = '' then 'May I check a few things with you 😊

-Have you/buyer seen any units here before?
-Are you/buyer buying for ownuse or investment? 
-Have you/buyer done the loan assessment already?' else welcome_note_2 end
where property_name = 'Wcega Tower_2';

-- REVV_2
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Wanni / REVV / Lilium' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available
What’s your business trade, rental term and rental start date?' else welcome_note_1 end
where property_name = 'REVV_2';

-- Enterprise One_3
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Ubi Indus / Faith / Ivan' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available
What’s your business trade, rental term and rental start date?' else welcome_note_1 end
where property_name = 'Enterprise One_3';

-- Yeley Building
update properties set
  tag_list = case when tag_list is null or tag_list = '' then 'Shu Feng / Yeley' else tag_list end,
  welcome_note_1 = case when welcome_note_1 is null or welcome_note_1 = '' then 'Hi, yes it’s available
What’s your business trade, rental term and rental start date?' else welcome_note_1 end
where property_name = 'Yeley Building';
