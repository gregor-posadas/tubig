Built by: mapshaper -i PH_Adm4_BgySubMuns.shp -filter 'geo_level=="Bgy"' -proj wgs84 -simplify 6% weighted keep-shapes -clean
  -dissolve adm3_psgc (municipal outline, c=0) -split adm3_psgc -o precision=0.00001
Source: faeldon/philippines-psgc-shapefiles, PSGC 3Q 2026 (NAMRIA & PSA via OCHA COD-AB, CC BY-IGO).
