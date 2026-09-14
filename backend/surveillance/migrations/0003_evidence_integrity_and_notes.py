from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('surveillance', '0002_intelligence_fields')]
    operations = [
        migrations.AddField(model_name='alert', name='evidence_sha256', field=models.CharField(blank=True, max_length=64)),
        migrations.AddField(model_name='alert', name='previous_evidence_hash', field=models.CharField(blank=True, max_length=64)),
        migrations.AddField(model_name='alert', name='chain_hash', field=models.CharField(blank=True, max_length=64)),
        migrations.AddField(model_name='alert', name='analyst_notes', field=models.TextField(blank=True)),
    ]
