from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('surveillance', '0001_initial')]

    operations = [
        migrations.AddField(model_name='alert', name='risk_score', field=models.IntegerField(default=0, help_text='0-100 contextual rule-based risk score')),
        migrations.AddField(model_name='alert', name='risk_level', field=models.CharField(default='NORMAL', max_length=20)),
        migrations.AddField(model_name='alert', name='risk_factors', field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name='alert', name='track_id', field=models.CharField(blank=True, max_length=40)),
        migrations.AddField(model_name='alert', name='dwell_seconds', field=models.FloatField(default=0)),
        migrations.AddField(model_name='alert', name='movement_speed', field=models.FloatField(default=0)),
        migrations.AddField(model_name='alert', name='correlation_id', field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name='alert', name='correlated_alert_count', field=models.PositiveIntegerField(default=0)),
        migrations.AlterField(model_name='alert', name='event_type', field=models.CharField(choices=[('RESTRICTED_ZONE_INTRUSION','Restricted-zone intrusion'),('PROLONGED_PRESENCE','Prolonged presence detected'),('UNUSUAL_MOVEMENT','Unusual movement'),('COMPOUND_INCIDENT','Compound incident'),('NORMAL_DETECTION','Normal object detection')], max_length=40)),
    ]
