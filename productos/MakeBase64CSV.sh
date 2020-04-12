#!/bin/bash
# Usage : MakeBase64CSV.sh infile.csv outfile.csv
# infile.csv columns are : externalID, filename or identifier
# infile.csv separator MUST BE |

echo \"External ID\",\"Image\" > $2

while IFS="|" read f1 f2; do

# recopy external ID
echo -n $f1, >> $2

#If second  column represents the key to match with the filename, please use this command
cat $(echo ${f2} | tr -d '\r' | tr -d '"').jpg | base64 --wrap=0 >> $2

#Carrier return at end of line
echo  >> $2
done < $1

