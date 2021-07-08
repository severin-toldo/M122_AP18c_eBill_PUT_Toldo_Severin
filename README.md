TODO: Doku, example below
TODO: Update config template


# M122 AP18c AutoBackup Toldo Severin

Guide for the project M122 AP18c AutoBackup Toldo Severin

## Installation

1) Install [NPM](https://www.npmjs.com/get-npm) (if not already done)
2) `npm install -g m122_ap18c_autobackup_toldo_severin`
3) `which autobackup`

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_Example: `/usr/local/bin/autobackup`_

4) `node /path/to/autobackup`

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_Example: `node /usr/local/bin/autobackup`_
<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_*Alternatively you can add it to PATH_


## Configuration

How to configure M122 AP18c AutoBackup Toldo Severin

### Arguments

List of possible arguments. They can be passed via a config file, as command line arguments or both. 
<br/>
<br/>
Note:
- default config file location: `/USER_HOME/autobackup-config.json`
- if `--configFile` argument is set, default config file will be ignored
- commandline arguments overwrite config files
- Config files must be valid json


| Argument            | Required | Description                           | Example Value       | Notes                                               |
|---------------------|----------|---------------------------------------|---------------------|-----------------------------------------------------|
| --ftpHost           | true     | FTP host address                      | ftpHost.com         |                                                     |
| --ftpUser           | true     | FTP username                          | ftpUser             |                                                     |
| --ftpPassword       | true     | FTP password                          | ftpPassword         |                                                     |
| --ftpBackupLocation | true     | Backup location on the FTP server     | /ftpBackupLocation  |                                                     |
| --emailService      | false    | E-Mail service to be used (ex. gmail) | gmail               | E-Mail are only sent if all email arguments are set |
| --emailUser         | false    | E-Mail username                       | emailUser@gmail.com | E-Mail are only sent if all email arguments are set |
| --emailPassword     | false    | E-Mail password                       | emailPassword       | E-Mail are only sent if all email arguments are set |
| --emailTo           | false    | E-Mail recipient                      | emailTo@gmail.com   | E-Mail are only sent if all email arguments are set |
| --file              | true     | File to backup                        | /path/to/file.txt   |                                                     |
| --logFile           | false    | File to log to                        | /path/to/file.log   |                                                     |
| --configFile        | false    | Non-Default Config file               | /path/to/file.json  | If set, default config file will be ignored         |

### File

Config file template

```json
{
	"ftpHost": "ftpHost.com",
	"ftpUser": "ftpUser",
	"ftpPassword": "ftpPassword",
	"ftpBackupLocation": "/ftpBackupLocation",
	"emailService": "gmail",
	"emailUser": "emailUser@gmail.com",
	"emailPassword": "emailPassword",
	"emailTo": "emailTo@gmail.com",
	"file": "/path/to/file.txt",
	"logFile": "/path/to/file.log"
}
```

## Example Commands

Command that specifies all arguments via command line argument
<br/>
```
node autobackup --ftpHost="ftpHost.com" --ftpUser="ftpUser" --ftpPassword="ftpPassword" --ftpBackupLocation="/ftpBackupLocation" --emailService="gmail" --emailUser="emailUser@gmail.com" --emailPassword="emailPassword" --emailTo="emailTo@gmail.com" --file="/path/to/file.txt" --logFile="/path/to/file.log"
```

Command that specifies custom config file and overwrites some arguments
<br/>
```
node autobackup --configFile=/path/to/config/file/autobackup.json --emailTo="emailUser@gmail.com" --file="/path/to/file.txt"
```










