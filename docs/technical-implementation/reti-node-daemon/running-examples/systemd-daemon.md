# systemd daemon

This is nothing more than a simple example configuration with no assurances provided.

For your own configuration, note the user / group parameters, and the validator, node, and network arguments in ExecStart which will need adjusted for your validator id (and later, network)

In this example, the reti binary and .env file were place inside /home/reti.

The Algorand node (running on the same  machine) is in the default /var/lib/algorand directory.

{% code title="/home/reti/.env" %}
```
ALGO_MNEMONIC=twenty five word mnemonics of your hotwallet manager account
```
{% endcode %}

{% code title="/etc/systemd/system/reti.service" fullWidth="false" %}
```systemd
[Unit]
Description=Reti daemon
After=network.target

[Service]
Type=simple
Environment="ALGORAND_DATA=/var/lib/algorand"
WorkingDirectory=/home/reti
ExecStart=/home/reti/reti --validator 1 --node 1 --network testnet daemon
User=reti
Group=reti
Restart=always
RestartSec=10s
ProtectSystem=false

[Install]
WantedBy=multi-user.target
```
{% endcode %}
