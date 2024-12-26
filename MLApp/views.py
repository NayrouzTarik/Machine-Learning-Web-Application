from django.db import models
from django.contrib.auth.models import User
import os
from django.conf import settings
from django.shortcuts import render
from pre_traitement.clean import clean_dataset, detect_target_column
import pandas as pd
from ml_models.decision_tree import DT
from ml_models.kmeans import KMeans
from ml_models.KNN import KNN
from ml_models.naive_bayes import naive_bayes
from ml_models.neural_network import MLP_model
from ml_models.random_forest import RF
from ml_models.regression import regression_model
from ml_models.svm import SVM
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
import json
import numpy as np
from io import StringIO
import chardet
import csv

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, pd.DataFrame):
            return obj.to_dict()
        return super(NumpyEncoder, self).default(obj)

class MLModelEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, 'tolist'):
            return obj.tolist()
        if hasattr(obj, '__dict__'):
            return str(type(obj).__name__)
        try:
            return float(obj)
        except (TypeError, ValueError):
            return str(obj)

def get_user_data_dir(user):
    user_data_dir = os.path.join(settings.MEDIA_ROOT, 'user_data_files', user.username)
    print(f"Creating directory: {user_data_dir}")
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)
        print(f"Directory created: {user_data_dir}")
    else:
        print(f"Directory already exists: {user_data_dir}")
    return user_data_dir
def read_file_with_encoding_and_delimiter(file_path):
    """
    Lit un fichier CSV ou Excel avec détection automatique d'encodage et de délimiteur.
    """
    try:
        file_extension = file_path.split('.')[-1].lower()
        if file_extension not in ['csv', 'xls', 'xlsx']:
            raise ValueError("Unsupported file type")

        if file_extension == 'csv':
            # Détection d'encodage
            with open(file_path, 'rb') as f:
                result = chardet.detect(f.read())
                detected_encoding = result['encoding']

            # Détection du délimiteur
            with open(file_path, 'r', encoding=detected_encoding) as csvfile:
                sniffer = csv.Sniffer()
                sample = csvfile.read(1024)
                delimiter = sniffer.sniff(sample).delimiter

            # Lire le fichier avec les paramètres détectés
            df = pd.read_csv(file_path, encoding=detected_encoding, delimiter=delimiter)
        elif file_extension in ['xls', 'xlsx']:
            # Lire un fichier Excel
            df = pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file type")
        
        return df
    except Exception as e:
        raise ValueError(f"Error reading file: {str(e)}")
    
import pandas as pd
import os
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

@login_required
def upload_data(request):
    if request.method == 'POST' and request.FILES.get('file'):
        try:
            # Récupérer l'utilisateur et le fichier
            user = request.user
            file = request.FILES['file']

            # Créer un répertoire utilisateur si nécessaire
            user_data_dir = get_user_data_dir(user)  # Assurez-vous que cette fonction existe
            os.makedirs(user_data_dir, exist_ok=True)

            # Sauvegarder le fichier dans le répertoire utilisateur
            file_path = os.path.join(user_data_dir, file.name)
            with open(file_path, 'wb+') as f:
                for chunk in file.chunks():
                    f.write(chunk)

            # Charger et afficher les données dans le terminal
            df = read_file_with_encoding_and_delimiter(file_path)
            print("\n\nDonnées uploadées :\n", df.head())

            # Sauvegarder les informations du fichier dans la session
            request.session['uploaded_file_path'] = file_path

            # Appeler la fonction process_data et afficher les statistiques dans le terminal
            # statistics = process_data(request)
            # print("\n\nStatistiques générées :\n", statistics)

            return JsonResponse({
                'success': True,
                'message': 'File uploaded and saved successfully',
                'file_path': file_path,
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

    return JsonResponse({
        'success': False,
        'error': 'No file provided'
    })

from django.views.decorators.http import require_http_methods
@login_required
@require_http_methods(["POST"])
def process_data(request):
    try:
        file_path = request.session.get('uploaded_file_path')
        if not file_path:
            return JsonResponse({
                'success': False,
                'error': 'No file path found in session'
            })

        # Read the uploaded file
        data = pd.read_csv(file_path) if file_path.endswith('.csv') else pd.read_excel(file_path)

        # Convert numpy types to Python native types
        statistics = {
            "columns": data.columns.tolist(),
            "shape": [int(x) for x in data.shape],
            "null_values": {k: int(v) for k, v in data.isnull().sum().items()},
            "duplicates_count": int(data.duplicated().sum()),
            "dtypes": {k: str(v) for k, v in data.dtypes.items()}
        }

        # Handle numeric analysis
        numeric_data = data.select_dtypes(include=['number'])
        if not numeric_data.empty:
            statistics.update({
                "mean_values": {k: float(v) for k, v in numeric_data.mean().items()},
                "variance_values": {k: float(v) for k, v in numeric_data.var().items()},
                "std_values": {k: float(v) for k, v in numeric_data.std().items()},
                "correlation_with_all_variables": numeric_data.corr().to_dict()
            })

        # Handle categorical analysis
        categorical_data = data.select_dtypes(include=['object', 'category'])
        if not categorical_data.empty:
            statistics["category_analysis"] = {
                col: categorical_data[col].value_counts().to_dict()
                for col in categorical_data.columns
            }

        # Store processed data in session
        request.session['df'] = data.to_json(orient='records')

        return JsonResponse({
            'success': True,
            'statistics': statistics
        }, encoder=NumpyEncoder)
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
    
@login_required
def clean_data(request):
    if request.method == 'POST':
        data_json = request.session.get('df')
        if not data_json:
            print("Error: No data available for cleaning.")
            return JsonResponse({'error': "No data available for cleaning."})

        df = pd.read_json(data_json)

        df_cleaned = clean_dataset(df)
        request.session['cleaned_data'] = df_cleaned.to_json()

        target_column, problem_type = detect_target_column(df_cleaned)

        print("\n--- Results of data cleaning and preprocessing ---\n")
        print(f"Detected target column: {target_column if target_column else 'None'}")
        print(f"Detected problem type: {problem_type if problem_type else 'Unknown'}")
        print("\n--- End of data cleaning and preprocessing ---\n")

        return JsonResponse({
            'success': "Data has been cleaned and preprocessed successfully.",
            'target_column': target_column,
            'problem_type': problem_type,
        })

    return JsonResponse({'error': "Invalid request."})

@csrf_exempt
def run_model(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            selected_model = data.get('model')
            target_type = data.get('target_type')
            features_name_target = data.get('features_name_target')
            print(f"Selected model: {selected_model}")
            print(f"Target type: {target_type}")
            print(f"Features name target: {features_name_target}")

            cleaned_data_json = request.session.get('cleaned_data')
            if not cleaned_data_json:
                return JsonResponse({"error": "No cleaned data found in session."}, status=400)

            df_cleaned = pd.read_json(StringIO(cleaned_data_json))
            print("Cleaned data loaded successfully")
            print(df_cleaned.head())  


            if selected_model == 'decision-tree':
                model, metrics = DT(df_cleaned)
                results = {"accuracy": metrics[0], "precision": metrics[1],
                           "recall": metrics[2], "f1": metrics[3]}
            elif selected_model == 'svm':
                model, metrics = SVM(df_cleaned)
                results = {"model_metrics": metrics}
            elif selected_model == 'random-forest':
                model, train_metric, test_metric = RF(df_cleaned)
                results = {"train_metric": train_metric, "test_metric": test_metric}
            elif selected_model == 'knn':
                model, train_metric, test_metric = KNN(df_cleaned)
                results = {"train_metric": train_metric, "test_metric": test_metric}
            elif selected_model == 'neural-network':
                model, metrics = MLP_model(df_cleaned)
                results = {"model_metrics": metrics}
            elif selected_model == 'k-means':
                model, metrics = KMeans(df_cleaned)
                results = {"model_metrics": metrics}
            elif selected_model == 'naive-bayes':
                model, accuracy, report = naive_bayes(df_cleaned)
                results = {
                    "accuracy": accuracy,
                    "classification_report": report
                }
            elif selected_model == 'regression':
                results = regression_model(df_cleaned)
            else:
                return JsonResponse({"error": "Unknown model."}, status=400)

            return JsonResponse({
                "results": results,
                "success": True
            })

        except Exception as e:
            print(f"Error in run_model: {e}")
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def get_compatible_features(request):
    try:
        data = json.loads(request.body)
        target_type = data.get('target_type')
        
        # Get DataFrame from session
        df_json = request.session.get('df')
        if not df_json:
            return JsonResponse({'error': 'No data available'}, status=400)
        
        df = pd.read_json(df_json)
        
        # Filter features based on type
        features = []
        for column in df.columns:
            dtype = str(df[column].dtype)
            if target_type == 'regression':
                if dtype in ['int64', 'float64']:
                    features.append({
                        'name': column,
                        'dtype': dtype,
                        'unique_count': len(df[column].unique())
                    })
            elif target_type == 'classification':
                if dtype in ['object', 'category'] or (dtype in ['int64', 'float64'] and len(df[column].unique()) < 10):
                    features.append({
                        'name': column,
                        'dtype': dtype,
                        'unique_count': len(df[column].unique())
                    })
                    
        return JsonResponse({
            'features': features,
            'recommendation': detect_problem_type(df)
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def detect_problem_type(df):
    categorical_threshold = 10
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    
    potential_categorical_targets = len([col for col in numeric_cols 
                                      if df[col].nunique() < categorical_threshold])
    
    if len(categorical_cols) > 0 or potential_categorical_targets > 0:
        return 'classification'
    elif len(numeric_cols) > 0:
        return 'regression'
    else:
        return 'clustering'

@csrf_exempt
def get_variables(request):
    try:
        df_json = request.session.get('df')
        if not df_json:
            return JsonResponse({'error': 'No data available'}, status=400)

        df = pd.read_json(df_json)
        variables = df.columns.tolist()

        return JsonResponse({
            'success': True,
            'variables': variables
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def get_plot_data(request):
    try:
        x_variable = request.GET.get('x_variable')
        y_variable = request.GET.get('y_variable')
        plot_type = request.GET.get('plot_type')

        df_json = request.session.get('df')
        if not df_json:
            return JsonResponse({'success': False, 'error': 'No data available'}, status=400)

        df = pd.read_json(df_json)

        # Validate columns exist
        if x_variable not in df.columns:
            return JsonResponse({
                'success': False, 
                'error': f'Column {x_variable} not found in dataset'
            }, status=400)

        if y_variable and y_variable not in df.columns:
            return JsonResponse({
                'success': False, 
                'error': f'Column {y_variable} not found in dataset'
            }, status=400)

        if plot_type == 'histogram':
            # Handle different data types for histogram
            if pd.api.types.is_numeric_dtype(df[x_variable]):
                # For numeric data, use value_counts with bins
                counts = pd.cut(df[x_variable], bins=10).value_counts().sort_index()
                labels = [str(interval) for interval in counts.index]
                values = counts.values.tolist()
            else:
                # For categorical data, use simple value_counts
                counts = df[x_variable].value_counts()
                labels = counts.index.astype(str).tolist()
                values = counts.values.tolist()

            data = {
                'labels': labels,
                'datasets': [{
                    'label': x_variable,
                    'data': values,
                    'backgroundColor': 'rgba(75, 192, 192, 0.2)',
                    'borderColor': 'rgba(75, 192, 192, 1)',
                    'borderWidth': 1
                }]
            }

        elif plot_type == 'scatter':
            # Validate both variables are numeric for scatter plot
            if not (pd.api.types.is_numeric_dtype(df[x_variable]) and 
                   pd.api.types.is_numeric_dtype(df[y_variable])):
                return JsonResponse({
                    'success': False,
                    'error': 'Both variables must be numeric for scatter plot'
                }, status=400)

            data = {
                'datasets': [{
                    'label': 'Scatter Plot',
                    'data': [{'x': x, 'y': y} for x, y in zip(
                        df[x_variable].tolist(), 
                        df[y_variable].tolist()
                    )],
                    'backgroundColor': 'rgba(75, 192, 192, 0.2)',
                    'borderColor': 'rgba(75, 192, 192, 1)',
                    'pointRadius': 5
                }]
            }

        elif plot_type == 'bar':
            if y_variable:
                # If y_variable is provided, use it for values
                data = {
                    'labels': df[x_variable].astype(str).tolist(),
                    'datasets': [{
                        'label': y_variable,
                        'data': df[y_variable].tolist(),
                        'backgroundColor': 'rgba(75, 192, 192, 0.2)',
                        'borderColor': 'rgba(75, 192, 192, 1)',
                        'borderWidth': 1
                    }]
                }
            else:
                # If no y_variable, use counts of x_variable
                counts = df[x_variable].value_counts()
                data = {
                    'labels': counts.index.astype(str).tolist(),
                    'datasets': [{
                        'label': f'{x_variable} Count',
                        'data': counts.values.tolist(),
                        'backgroundColor': 'rgba(75, 192, 192, 0.2)',
                        'borderColor': 'rgba(75, 192, 192, 1)',
                        'borderWidth': 1
                    }]
                }
        else:
            return JsonResponse({
                'success': False,
                'error': 'Unsupported plot type'
            }, status=400)

        return JsonResponse({
            'success': True,
            'plot_data': data
        })

    except Exception as e:
        import traceback
        print(f"Error in get_plot_data: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)